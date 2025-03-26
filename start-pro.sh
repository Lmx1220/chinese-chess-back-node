#!/bin/bash

# 容器名称
CONTAINER_NAME="chess-back"

# 镜像名称
IMAGE_NAME="chess-back"

# 检查容器是否存在，如果存在则删除
if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
    echo "删除已存在的容器: ${CONTAINER_NAME}"
    docker rm -f ${CONTAINER_NAME}
fi

# 检查images是否存在，如果存在则删除
if [ "$(docker images -q ${IMAGE_NAME})" ]; then
    echo "删除已存在的镜像: ${IMAGE_NAME}"
    docker rmi -f ${IMAGE_NAME}
fi

# 构建 Docker 镜像
echo "开始构建 Docker 镜像: ${IMAGE_NAME}"
docker build -t ${IMAGE_NAME} .

# 运行容器
echo "保存镜像: ${CONTAINER_NAME}"
docker save -o ${IMAGE_NAME}.tar ${IMAGE_NAME}:latest

echo "镜像以保存 ${IMAGE_NAME}.tar"