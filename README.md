# Node连接MongoDB连接池
EXpress项目中使用的连接池，具有连接数动态调整的功能。连接池在编写过程中有参考其他人的连接池，在此表示感谢。

## 功能介绍

本连接池使用的是MongoDB默认的获取连接的方式，将获取的连接数管理起来形成连接池，具有如下的特点：

+ 连接池具有最大最小连接数
+ 默认创建连接池使用的是默认的连接数
+ 连接数连接数在用完时以1.5倍增加
+ 连接数一半空闲的情况下释放一半的连接

例如：默认创建10个连接的连接池，最大连接数为50，最小连接数为10，动态调整的策略如下：

![连接池连接数调整](https://github.com/wangxin1248/node-mongodb-pool/blob/master/连接池连接数调整.png)

## 使用

### 引用连接池模块
    var MongoPool = require('./mongo-pool').MongoPool;

### 创建连接池对象
    var pool = new MongoPool({
    db: 'courseWeb', 
    poolSize: 10,
    minSize:10,
    maxSize:50
    });

### 操作数据库
    pool.getClient(function(client) {
        // 数据库操作
        
        pool.release(client);
    });


