/**
 * Created by wangx on 2017/5/27.
 * Node连接MongoDB连接池
 */

var EventEmitter = require('events').EventEmitter;
var mongodb = require('mongodb');


/**
 * 数据库连接池创建
 * @type {exports.MongoPool}
 */
var MongoPool = exports.MongoPool = function MongoPool(options) {

    // 用数组来存储当前连接池数据库连接对象
    this._pool = [];
    // 用数组来存储当前使用的连接池
    this._use = [];
    // 用数组实现的队列来存储等待中的请求
    this._queue = [];
    // 连接池是否关闭的状态
    this._closing = false;

    // 设置数据库连接配置以及对应的默认配置
    options = options || {};
    options.host = options.host || '127.0.0.1';
    options.port = options.port || 27017;
    options.db = options.db || 'courseWeb';
    options.poolSize = options.poolSize > 0 ? options.poolSize : 5;
    options.minSize = options.minSize> 0 ? options.minSize : 5;
    options.maxSize = options.maxSize> 0 ? options.maxSize : 5;


    /**
     * 归还连接对象到连接池中
     */
    this.on('release', function(client) {
        if (this._closing) {
            client.close();
        } else if (this._queue.length > 0) {

            // 首先先清空等待队列
            this._queue.shift().call(this, client);

            // 控制使用连接数在连接池连接数范围内
            if (this._use.length<options.poolSize){
                this._use.push(client);
            }

            // 使用的连接已经和当前设置的连接一样多了并且增加为1.5倍也不超过当前连接池的最大连接数
            // 则更新连接池的连接数为当前的1.5倍
            if ((this._use.length === options.poolSize)&&(parseInt(options.poolSize*1.5)<options.maxSize)){
                var start = options.poolSize;
                var end = parseInt(options.poolSize*1.5);
                init(start,end);
                options.poolSize = end;
            }

            // 加入当前连接池的1.5倍要超过连接池所设定的最大连接数
            // 则将当前的连接池的连接数更新为当前连接池的最大容量
            if ((this._use.length === options.poolSize)&&(parseInt(options.poolSize*1.5)>=options.maxSize)){
                var start = options.poolSize;
                var end = options.maxSize;
                if (start<end){
                    init(start,end);
                    options.poolSize = end;
                }
            }

        // 开始归还连接
        } else if (this._pool.indexOf(client) === -1) {
            if (this._pool.length>=options.minSize){
                client.close();
                options.poolSize = this._pool.length;
                while (this._use.length+this._pool.length>options.poolSize){
                    this._use.shift();
                }
            }else {
                this._pool.push(client);
                while (this._use.length+this._pool.length>options.poolSize){
                    this._use.shift();
                }
            }
        }
    });


    /**
     * 初始化，创建具有指定连接对象个数的的连接池
     */
    var self = this;

    init(0,options.poolSize);

    // 封装函数进行创建连接对象
    function init(start,end){
        for (var i = start; i < end; i++) {
            self.createClient(options.host, options.port, options.db)
                .open(function(error, client) {
                    if (error) throw error;
                    self.release(client);
                });
        }
    }
}


/**
 * 继承EventEmitter ，node.js中用来处理事件以及回掉的对象
 */
MongoPool.prototype.__proto__ = EventEmitter.prototype;

/**
 * 创建并返回一个`mongodb.Db`实例
 *
 * @param {String} host 数据库服务主机名
 * @param {Number|String} port 数据库服务端口号
 * @param {String} db 数据库名称
 * @return {Object} 数据库连接对象
 */
MongoPool.prototype.createClient = function(host, port, db) {
    var client = new mongodb.Db(db, new mongodb.Server(host, port, {auto_reconnect: true}));
    return client;
};

/**
 * 从数据库连接池中获取一个连接对象或者使用回调函数从队列中拿取连接
 *
 * @param {Function} callback 回调函数返回一个数据库连接对象
 *
 *      `function(client) {}`
 *
 */
MongoPool.prototype.getClient = function(callback) {
    // 将所有的连接请求加入到等待队列中去
    if (this._pool.length > 0) {
        callback.call(this, this._pool.shift());
    } else {
        this._queue.push(callback);
    }
};

/**
 * 获取一个数据库中的集合对象
 *
 * @param {String} name 集合名称
 * @param {Function} callback 回调函数返回一个集合对象
 *
 *      `function(error, collection) {}`
 */
MongoPool.prototype.getCollection = function(name, callback) {
    this.getClient(function(client) {
        client.collection(name, callback);
    });
};

/**
 * 归还连接对象到连接池中
 * 返回数据库连接池处理释放连接对象的结果
 *
 * @param {Object} client `mongodb.Db`或者`mongodb.Collection`对象
 * @return {Boolean}
 */
MongoPool.prototype.release = function(client) {
    // 根据对象的不同使用不同的关闭连接方法
    if (client instanceof mongodb.Db) {
        // EventEmitter发送event事件
        return this.emit('release', client);
    } else if (client instanceof mongodb.Collection) {
        return this.emit('release', client.db);
    }
    return false;
}

/**
 * 关闭所有的数据库连接对象
 */
MongoPool.prototype.destroy = function() {
    this._closing = true;
    this._pool.forEach(function(client) {
        client.close();
        this._use.shift();
    });
};