创建生成证书所需的配置文件
创建生成证书所需的配置文件，文件内容如下：
```
[ req ]

default_bits        = 2048
default_keyfile     = server-key.pem
distinguished_name  = subject
req_extensions      = req_ext
x509_extensions     = x509_ext
string_mask         = utf8only

[ subject ]

countryName                 = Country Name (2 letter code)
countryName_default         = US

stateOrProvinceName         = State or Province Name (full name)
stateOrProvinceName_default = NY

localityName                = Locality Name (eg, city)
localityName_default        = New York

organizationName            = Organization Name (eg, company)
organizationName_default    = Example, LLC

commonName                  = Common Name (e.g. server FQDN or YOUR name)
commonName_default          = Example Company

emailAddress                = Email Address
emailAddress_default        = test@example.com

[ x509_ext ]

subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer

basicConstraints       = CA:FALSE
keyUsage               = digitalSignature, keyEncipherment
subjectAltName         = @alternate_names
nsComment              = "OpenSSL Generated Certificate"

[ req_ext ]

subjectKeyIdentifier = hash

basicConstraints     = CA:FALSE
keyUsage             = digitalSignature, keyEncipherment
subjectAltName       = @alternate_names
nsComment            = "OpenSSL Generated Certificate"

[ alternate_names ]

DNS.1       = test.local
```
注意将文件的最后一行的改成自己的域名DNS.1=test.local。将文件保存并命名为test.local.conf。

生成证书，在命令行中运行：
openssl req -config test.local.conf -new -sha256 -newkey rsa:2048 -nodes -keyout test.local.key -x509 -days 365 -out test.local.crt

``` 
openssl req -config test.local.conf -new -sha256 -newkey rsa:2048 -nodes -keyout test.local.key -x509 -days 365 -out test.local.crt
```
生成证书时，会有一系列问题需要填写，其他的问题都可以敲回车直接跳过，只将common name填写成你的域名，例如：

```
Common Name (e.g. server FQDN or YOUR name) []:test.local
```
命令运行成功会在当前目录下生成两个文件：test.local.crt, test.local.key
