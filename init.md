# 框架

# 第一步执行
```bash
npm run install
```
# 第二步 创建数据库和执行sql脚本 [d_chess.sql](d_chess.sql)

# 第三步修改配置 [config.ts](src/configs/config.ts) 和 [enums.ts](src/configs/enums.ts)
```ts
config.ts

export const enum REDIS {
    HOST = '******',
    PORT = 6379,
    DB_NAME = 5,
    PASSWORD = '******',
}

export const enum config {
    DB_USER = 'd_chess',
    DB_PASSWORD = '******',
    DB_HOST = '******',
    // DB_USER = 'root',
    // DB_PASSWORD = '******',
    // DB_HOST = '192.168.1.60',

    DB_PORT = 3306,
    DB_NAME = 'd_chess',
}

export const enum EMAIL_CONFIG {
    HOST = 'smtp.qq.com',
    PORT = 587,
    // 你的QQ账号
    USER = '****@qq.com',
    // 非你的QQ密码，为邮箱授权码
    PASSWORD = '******',

}

export const enum APP {
    // 文件上传的本地路径
    FILE_LOCAL_PATH = '/data/projects/uploadfile/',
    // 文件上传时的域名
    FILE_SHOW_DOMAIN = 'http://47.108.93.44:90/images',
    // 分享时的域名
    SHARE_DOMAIN = 'http://47.108.93.44:90',
}

enums.ts
```

# 第四步 执行
```bash
npm run start
```

