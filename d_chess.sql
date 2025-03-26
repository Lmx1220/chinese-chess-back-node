/*
 Navicat Premium Data Transfer

 Source Server         : mac
 Source Server Type    : MySQL
 Source Server Version : 80404 (8.4.4)
 Source Host           : localhost:3306
 Source Schema         : d_chess

 Target Server Type    : MySQL
 Target Server Version : 80404 (8.4.4)
 File Encoding         : 65001

 Date: 26/03/2025 20:17:00
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for t_battle
-- ----------------------------
DROP TABLE IF EXISTS `t_battle`;
CREATE TABLE `t_battle`
(
    `id`               varchar(64) NOT NULL COMMENT '对战表主键',
    `room_id`          int         NOT NULL COMMENT '房间号',
    `room_status`      varchar(32) NOT NULL COMMENT '房间状态(枚举值参考const.js)',
    `win_code`         varchar(32) DEFAULT NULL COMMENT '对战结果(参考const.js)',
    `win_msg`          varchar(32) DEFAULT NULL COMMENT '对战结果描述：红棋/黑棋/和棋',
    `win_user_id`      varchar(32) DEFAULT NULL COMMENT '胜利方userId',
    `curr_is_red_move` tinyint(1)  DEFAULT NULL COMMENT '当前是否红棋落子(true/false)',
    `send_peace`       varchar(4)  DEFAULT NULL COMMENT '对局发起求和(Y/N)',
    `send_back_chess`  varchar(4)  DEFAULT NULL COMMENT '对局发起悔棋(Y/N)',
    `send_user_id`     varchar(32) DEFAULT NULL COMMENT '请求发起方userId',
    `create_time`      datetime    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`      datetime    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='对战信息表(双方进入对局后生成)';

-- ----------------------------
-- Records of t_battle
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_battle_chat
-- ----------------------------
DROP TABLE IF EXISTS `t_battle_chat`;
CREATE TABLE `t_battle_chat`
(
    `id`          int          NOT NULL AUTO_INCREMENT COMMENT '自增主键(对战聊天信息表)',
    `battle_id`   varchar(64)  NOT NULL COMMENT '对战表主键',
    `user_id`     varchar(32)  NOT NULL COMMENT '账号',
    `content`     varchar(100) NOT NULL COMMENT '聊天内容',
    `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='对战聊天信息表';

-- ----------------------------
-- Records of t_battle_chat
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_battle_flow
-- ----------------------------
DROP TABLE IF EXISTS `t_battle_flow`;
CREATE TABLE `t_battle_flow`
(
    `id`          int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(对战流水表)',
    `room_id`     int         NOT NULL COMMENT '房间号',
    `battle_id`   varchar(64) NOT NULL COMMENT '对战表主键',
    `user_id`     varchar(32) NOT NULL COMMENT '创建人',
    `type`        varchar(4)  NOT NULL COMMENT '0001-求和, 0002-认输, 0003-悔棋',
    `result`      varchar(2) DEFAULT NULL COMMENT 'Y-成功/同意, N-失败/拒绝',
    `create_time` datetime   DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='对战流水表';

-- ----------------------------
-- Records of t_battle_flow
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_battle_map_history
-- ----------------------------
DROP TABLE IF EXISTS `t_battle_map_history`;
CREATE TABLE `t_battle_map_history`
(
    `id`                int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(对战历史步骤表)',
    `battle_id`         varchar(64) NOT NULL COMMENT '对战表主键',
    `user_id`           varchar(32) NOT NULL COMMENT '账号',
    `game_fen`          text        NOT NULL COMMENT '游戏棋盘',
    `is_red_move`       tinyint(1)  NOT NULL COMMENT '是否红棋落子(true/false)',
    `step_explain`      varchar(255)         DEFAULT NULL COMMENT '步骤',
    `step_count`        int         NOT NULL DEFAULT '0' COMMENT '对局计步',
    `think_time`        int                  DEFAULT NULL COMMENT '思考时间',
    `last_src_chess`    varchar(300)         DEFAULT NULL COMMENT '最后落子的位置',
    `last_target_chess` varchar(255)         DEFAULT NULL,
    `src_box_chess`     varchar(100)         DEFAULT NULL COMMENT '特效盒子的位置',
    `target_box_chess`  varchar(255)         DEFAULT NULL,
    `all_time`          int         NOT NULL COMMENT '局时(单位：秒)',
    `step_time`         int         NOT NULL COMMENT '步时(单位：秒)',
    `create_time`       datetime             DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`       datetime             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    KEY `IDX_BATTLE_USER` (`battle_id`, `user_id`) USING BTREE
) ENGINE = InnoDB COMMENT ='对战历史步骤表';

-- ----------------------------
-- Records of t_battle_map_history
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_battle_user
-- ----------------------------
DROP TABLE IF EXISTS `t_battle_user`;
CREATE TABLE `t_battle_user`
(
    `id`              int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(对战用户表)',
    `room_id`         int         NOT NULL COMMENT '房间号',
    `battle_id`       varchar(64) NOT NULL COMMENT '对战表主键',
    `user_id`         varchar(32) NOT NULL COMMENT '用户账号',
    `user_name`       varchar(32) NOT NULL COMMENT '用户昵称',
    `enemy_id`        varchar(32) NOT NULL COMMENT '敌方账号',
    `enemy_name`      varchar(32) NOT NULL COMMENT '敌方昵称',
    `first`           tinyint(1)  NOT NULL COMMENT '是否先手(true/false)',
    `change_score`    int         DEFAULT NULL COMMENT '本局结算的积分',
    `action_time`     datetime    DEFAULT NULL COMMENT '加入时间',
    `user_page`       varchar(32) DEFAULT NULL COMMENT '玩家位置(某页面)',
    `user_status`     varchar(32) DEFAULT NULL COMMENT '玩家状态(对局/观战)',
    `move_chess_time` datetime    DEFAULT NULL COMMENT '移动棋子时间',
    `offline_time`    datetime    DEFAULT NULL COMMENT '离线时间(对局发生离线)',
    `create_time`     datetime    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`     datetime    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='对战用户信息表';

-- ----------------------------
-- Records of t_battle_user
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_code
-- ----------------------------
DROP TABLE IF EXISTS `t_code`;
CREATE TABLE `t_code`
(
    `id`          int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(验证码表)',
    `user_id`     varchar(32) NOT NULL COMMENT '账号',
    `email`       varchar(32) NOT NULL COMMENT '收件人',
    `valid_code`  varchar(8)  NOT NULL COMMENT '验证码',
    `code_type`   varchar(32) NOT NULL COMMENT '验证码类型',
    `data_status` varchar(4)  NOT NULL COMMENT '是否有效, Y-有, N-无',
    `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='验证码表';

-- ----------------------------
-- Records of t_code
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_email
-- ----------------------------
DROP TABLE IF EXISTS `t_email`;
CREATE TABLE `t_email`
(
    `id`          int           NOT NULL AUTO_INCREMENT COMMENT '自增主键(邮件表)',
    `user_id`     varchar(32)   NOT NULL COMMENT '账号',
    `subject`     varchar(256)  NOT NULL COMMENT '邮件主题',
    `to`          varchar(128)  NOT NULL COMMENT '收件人',
    `html`        varchar(1024) NOT NULL COMMENT '邮件内容(html)',
    `send_result` varchar(2)    NOT NULL COMMENT '发送结果：Y/N',
    `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='邮件信息表';

-- ----------------------------
-- Records of t_email
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_file
-- ----------------------------
DROP TABLE IF EXISTS `t_file`;
CREATE TABLE `t_file`
(
    `id`           int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(文件)',
    `user_id`      varchar(32) NOT NULL COMMENT '创建人',
    `file_id`      varchar(64) NOT NULL COMMENT '文件Id',
    `file_name`    varchar(64) NOT NULL COMMENT '文件名称',
    `suffix`       varchar(16) NOT NULL COMMENT '文件后缀(示例：.png/.zip)',
    `file_size`    int         NOT NULL COMMENT '文件大小',
    `content_type` varchar(20) NOT NULL COMMENT '文件类型，例: image/png',
    `create_time`  datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`  datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='文件表';

-- ----------------------------
-- Records of t_file
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_room_flow
-- ----------------------------
DROP TABLE IF EXISTS `t_room_flow`;
CREATE TABLE `t_room_flow`
(
    `id`          int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(房间流水表)',
    `room_id`     int         NOT NULL COMMENT '房间号',
    `user_id`     varchar(32) NOT NULL COMMENT '创建人Id',
    `enemy_id`    varchar(32) DEFAULT NULL COMMENT '对手Id',
    `value`       varchar(64) DEFAULT NULL COMMENT '值',
    `type`        varchar(4)  NOT NULL COMMENT '0001-被踢, 0002-加锁',
    `create_time` datetime    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB COMMENT ='房间流水表';

-- ----------------------------
-- Records of t_room_flow
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_share
-- ----------------------------
DROP TABLE IF EXISTS `t_share`;
CREATE TABLE `t_share`
(
    `id`             int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(对局分享表)',
    `battle_id`      varchar(64) NOT NULL COMMENT '对战表主键',
    `user_id`        varchar(32) NOT NULL COMMENT '分享人Id',
    `user_name`      varchar(32)          DEFAULT NULL COMMENT '分享人名称',
    `share_code`     varchar(32) NOT NULL COMMENT '分享码',
    `validity_day`   int                  DEFAULT '0' COMMENT '有效天数，0-永久有效',
    `view_count`     int         NOT NULL DEFAULT '0' COMMENT '浏览次数',
    `share_password` varchar(8)           DEFAULT NULL COMMENT '分享需要的密码(默认不需要)',
    `create_time`    datetime             DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`    datetime             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `uni_share_code` (`share_code`) USING BTREE,
    KEY `idx_share_code` (`share_code`) USING BTREE
) ENGINE = InnoDB COMMENT ='对局分享表';

-- ----------------------------
-- Records of t_share
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_user
-- ----------------------------
DROP TABLE IF EXISTS `t_user`;
CREATE TABLE `t_user`
(
    `user_id`          varchar(32) NOT NULL COMMENT '账号',
    `user_name`        varchar(32)  DEFAULT NULL COMMENT '名称',
    `password`         varchar(32) NOT NULL COMMENT '密码',
    `email`            varchar(32)  DEFAULT NULL COMMENT '邮箱(可选)',
    `user_type`        varchar(4)  NOT NULL COMMENT '用户类型(0001-普通用户, 0002-游客)',
    `score`            int         NOT NULL COMMENT '积分',
    `icon_url`         varchar(200) DEFAULT NULL COMMENT '头像内容',
    `ip`               varchar(32)  DEFAULT NULL COMMENT 'IP地址',
    `finger`           varchar(64)  DEFAULT NULL COMMENT '指纹采集数据',
    `ticket`           varchar(32) NOT NULL COMMENT '凭证信息(快速登录)',
    `pk_total_count`   int         NOT NULL COMMENT '对局次数',
    `pk_win_count`     int         NOT NULL COMMENT '对局胜利次数',
    `pk_fail_count`    int         NOT NULL COMMENT '对局失败次数',
    `pk_peace_count`   int         NOT NULL COMMENT '对局和棋次数',
    `pk_offline_count` int         NOT NULL COMMENT '对局断线次数',
    `data_status`      varchar(4)  NOT NULL COMMENT '是否有效, Y-有效, N-无效',
    `create_time`      datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`      datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`user_id`) USING BTREE
) ENGINE = InnoDB COMMENT ='用户信息表';

-- ----------------------------
-- Records of t_user
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_user_state
-- ----------------------------
DROP TABLE IF EXISTS `t_user_state`;
CREATE TABLE `t_user_state`
(
    `id`              int         NOT NULL AUTO_INCREMENT COMMENT '自增主键(用户状态)',
    `user_id`         varchar(32) NOT NULL COMMENT '账号',
    `token`           varchar(64) DEFAULT NULL COMMENT '会话token',
    `user_page`       varchar(32) NOT NULL COMMENT '玩家位置(某页面)',
    `room_id`         int         DEFAULT NULL COMMENT '房间号(加入房间后)',
    `join_type`       varchar(16) DEFAULT NULL COMMENT '加入类型，random-匹配对战, freedom-开房约战',
    `room_status`     varchar(32) DEFAULT NULL COMMENT '房间状态(枚举值参考const.js)',
    `first`           tinyint(1)  DEFAULT NULL COMMENT '是否先手(true/false)',
    `is_room_admin`   tinyint(1)  DEFAULT NULL COMMENT '是否房主(加入房间后)',
    `lock_pass`       int         DEFAULT NULL COMMENT '房间锁密码',
    `is_ready`        tinyint(1)  DEFAULT NULL COMMENT '是否已准备(加入房间后)',
    `battle_id`       varchar(64) DEFAULT NULL COMMENT '对战表Id(发生对战后)',
    `user_status`     varchar(32) DEFAULT NULL COMMENT '玩家状态-对局/观战(枚举值参考const.js)',
    `action_time`     datetime    DEFAULT NULL COMMENT '用户加入时间',
    `disconnect_time` datetime    DEFAULT NULL COMMENT '用户断开时间(与服务器断开)',
    `create_time`     datetime    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`     datetime    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `user_id` (`user_id`) USING BTREE
) ENGINE = InnoDB COMMENT ='用户状态表(玩家在游戏中的游离状态记录)';

-- ----------------------------
-- Records of t_user_state
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for t_version
-- ----------------------------
DROP TABLE IF EXISTS `t_version`;
CREATE TABLE `t_version`
(
    `version_id`  varchar(16) NOT NULL COMMENT '版本Id',
    `online_time` datetime    NOT NULL COMMENT '版本上线时间',
    `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`version_id`) USING BTREE
) ENGINE = InnoDB COMMENT ='版本表';

-- ----------------------------
-- Records of t_version
-- ----------------------------
BEGIN;
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.0.1', '2024-07-26 13:49:08', '2024-07-26 13:49:08', '2025-03-15 19:25:50');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.0.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.0.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.0.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.5', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.1.6', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.2.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.2.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.5', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.6', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.3.7', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.4.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.4.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.4.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.4.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.5.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.5.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.5.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('0.5.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.0.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.0.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.0.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.1.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.1.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.1.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.2.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.2.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.2.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.3.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.3.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.4.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.4.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.4.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.4.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.4.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.5.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.5.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.5.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.5.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.5.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.5.5', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.6.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.6.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.6.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.7.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.7.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.7.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.7.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.7.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.8.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('1.8.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.0', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.3', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.4', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.5.b1', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version` (`version_id`, `online_time`, `create_time`, `update_time`)
VALUES ('2.0.5.b2', '2025-03-20 23:46:32', '2025-03-20 23:46:32', '2025-03-20 23:46:32');
COMMIT;

-- ----------------------------
-- Table structure for t_version_detail
-- ----------------------------
DROP TABLE IF EXISTS `t_version_detail`;
CREATE TABLE `t_version_detail`
(
    `id`          int          NOT NULL AUTO_INCREMENT COMMENT '自增主键(版本详情)',
    `version_id`  varchar(16)  NOT NULL COMMENT '版本Id',
    `change_type` varchar(2)   NOT NULL COMMENT '变更类型, A-新增, M-修改, D-删除, B-修复问题',
    `content`     varchar(128) NOT NULL COMMENT '内容体',
    `sort`        int          NOT NULL COMMENT '序号, 1-n, 越大越靠前',
    `style`       varchar(4) DEFAULT NULL COMMENT '内容样式',
    `create_time` datetime   DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB
  AUTO_INCREMENT = 122 COMMENT ='版本详情表';

-- ----------------------------
-- Records of t_version_detail
-- ----------------------------
BEGIN;
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (1, '0.0.1', 'A', '作者：lmx', 1, NULL, '2024-07-26 13:49:08', '2025-03-11 12:33:57');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (2, '0.0.1', 'A', '客户端技术：react + antd-mobile + socket.io-client', 2, NULL, '2024-07-26 13:49:08',
        '2025-03-22 06:54:28');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (3, '0.0.1', 'A', '服务端技术：node.js + socket.io + nodemailer', 3, NULL, '2024-07-26 13:49:08',
        '2024-07-26 13:49:08');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (4, '0.0.1', 'A', '版本管理：Gitee', 4, NULL, '2024-07-26 13:49:08', '2024-07-26 13:49:08');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (5, '0.0.1', 'A', '数据库：MySQL + Redis', 5, NULL, '2024-07-26 13:49:08', '2025-03-22 06:53:51');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (6, '0.0.1', 'A',
        '目标：实现基于联网的实时对战游戏，包括：登录、注册、匹配、对局、观战、聊天、悔棋、求和、认输、数据断连等功能', 6, NULL,
        '2024-07-26 13:49:08', '2024-07-26 13:49:08');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (7, '0.0.2', 'A', '新增棋盘铺设、棋子移动', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (8, '0.0.2', 'A', '新增车、马、象、士、将、炮、卒的行走规则', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (9, '0.0.2', 'A', '棋子被选中或移动时增加选棋框', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (10, '0.0.2', 'A', '按钮、棋子点击时增加音效', 4, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (11, '0.0.3', 'A', '新增双方boss碰面规则检测', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (12, '0.0.3', 'A', '新增boss是否被将死检测', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (13, '0.0.3', 'M', 'boss被攻击时音效提示', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (14, '0.0.4', 'M', '对公共资源(图片、音效)进行提取统一管理', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (15, '0.0.4', 'B', '解决游戏正常进行时意外被结算的问题', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (16, '0.0.4', 'M', '提升boss是否被将死检测的搜索效率', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (17, '0.1.0', 'A', '新增在线人数展示', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (18, '0.1.0', 'A', '新增在线匹配功能', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (19, '0.1.0', 'M', '对局完成后交换先手方', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (20, '0.1.1', 'A', '对不同分辨率下的手机进行适配', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (21, '0.1.1', 'M', '提升体验效果，替换一套高清棋盘及棋子', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (22, '0.1.2', 'A', '新增棋子被选中时自动显示棋子可走的位置功能', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (23, '0.1.3', 'A', '对战双方用户信息展示', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (24, '0.1.3', 'A', '对战增加倒计时显示', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (25, '0.1.4', 'M', '优化audio在IOS上延时播放的问题', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (26, '0.1.4', 'M', '对所有配置进行提取，包括游戏配置、对局配置、socket配置', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (27, '0.1.5', 'A', '新增对局结束后计算胜率、扣分机制', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (28, '0.1.6', 'B', '对局结束后计分正确但显示错误的问题', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (29, '0.2.0', 'A', '新增对局聊天功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (30, '0.2.0', 'A', '新增平台菜单，支持匹配模式、对局观战、对局复盘', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (31, '0.2.0', 'B', '解决双方boss可以碰面的问题', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (32, '0.2.1', 'A', '新增对局观战功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (33, '0.2.1', 'B', '解决对局时，消息重叠的问题', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (34, '0.3.0', 'A', '新增对局超时结算功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (35, '0.3.0', 'A', '新增棋子传递时保存快照功能', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (36, '0.3.0', 'M', '平衡游戏比分', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (37, '0.3.1', 'A', '新增用户断线重连时，自动恢复房间数据(如果有)', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (38, '0.3.2', 'B', '解决观战数据有时无法同步的问题', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (39, '0.3.2', 'B', '解决观战时棋盘偶尔被翻转的问题', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (40, '0.3.2', 'B', '解决观战列表分页数据错误的问题', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (41, '0.3.3', 'A', '新增对手离线时通知给对手及观战方', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (42, '0.3.3', 'A', '新增对掉线的用户设置超时时间，若超过规定时间则对房间进行结算', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (43, '0.3.4', 'M', '对相关按钮增加图文并排', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (44, '0.3.5', 'M', '新增日志工具，日志统一归纳输出', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (45, '0.3.6', 'B', '解决用户以观战角色加入房间时，导致对局结算错误的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (46, '0.3.7', 'B', '解决偶尔进入游戏时，棋盘棋子与落子方不一致的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (47, '0.4.0', 'A', '新增对局求和功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (48, '0.4.0', 'A', '新增游戏结束后限制其操作棋盘、认输、悔棋等功能', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (49, '0.4.0', 'B', '解决对局超时后，未进行结算的问题', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (50, '0.4.1', 'B', '解决观战用户离开后，房间状态异常导致无法结算的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (51, '0.4.2', 'M', '对聊天文字显示进行优化，去除字数限制功能', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (52, '0.4.3', 'B', '解决用户离线且被服务器踢出后，仍然滞留在房间的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (53, '0.5.0', 'A', '新增对局悔棋功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (54, '0.5.1', 'A', '新增登录、注册功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (55, '0.5.1', 'M', '当对局发生悔棋时，通知给正在观战的用户', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (56, '0.5.2', 'B', '解决注册时使用邮箱，邮箱位数限制在4位的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (57, '0.5.2', 'B', '解决用户重新登录游戏，存在对战房间但未进行数据恢复的问题', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (58, '0.5.3', 'B', '解决断线重连恢复数据后，悔棋发生错误的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (59, '0.5.3', 'B', '解决匹配时，始终无法匹配到第一个房间的问题', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (60, '1.0.0', 'M', '整理相关Api并去除不合理的Api', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (61, '1.0.0', 'M', '定义入参、出参标准', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (62, '1.0.0', 'A', '新增客户端接入时校验服务端已发行的版本', 3, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (63, '1.0.0', 'M', '登录增加默认记住账号密码功能', 4, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (64, '1.0.0', 'B', '解决对房间内已准备但切后台的用户，无法进入游戏的问题', 5, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (65, '1.0.0', 'M', '对所有定时任务进行归类整理', 6, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (66, '1.0.1', 'B', '解决选择棋子时，该棋子可着点不提示的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (67, '1.0.1', 'M', '对落子方的头像进行动态旋转显示(用于醒目)', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (68, '1.0.2', 'M', '注册时的邮箱限制输入中文', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (69, '1.1.0', 'A', '新增账号冲突检测功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (70, '1.1.1', 'B', '解决节点在某些情况下被不停重绘的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (71, '1.1.1', 'M', '对棋盘进行精度裁剪，消除棋子位置微小差异', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (72, '1.1.2', 'A', '游戏即将超时提醒功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (73, '1.2.0', 'A', '新增对局复盘功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (74, '1.2.0', 'B', '解决悔棋时偶尔会造成双方都可以走棋的问题', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (75, '1.2.0', 'M', '注册成功后支持自动登录游戏', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (76, '1.2.1', 'B', '解决偶尔boss被困死的情况下未进行结算的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (77, '1.2.2', 'B', '解决复盘和观战列表翻页时，滚动条还停留在底部的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (78, '1.3.0', 'A', '登录时支持使用邮箱进行登录', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (79, '1.3.0', 'A', '注册账号增加邮箱验证码校验', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (80, '1.3.1', 'M', '观战时，对战结束后可不需要退出房间即可观看此房间新开的对局', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (81, '1.4.0', 'A', '双方都无可进攻棋子时，对局判和', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (82, '1.4.1', 'M', '棋子显示效果优化', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (83, '1.4.2', 'B', '解决对局和观战时无法恢复数据的问题', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (84, '1.4.3', 'M', '当服务器丢失心跳包时，引导用户进行重连', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (85, '1.4.4', 'A', '新增忘记密码找回功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (86, '1.5.0', 'A', '新增游客登录功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (87, '1.5.1', 'A', '新增禁止长将功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (88, '1.5.2', 'M', '棋子移动时动态效果优化(GPU绘制)', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (89, '1.5.3', 'A', '悔棋增加次数限制', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (90, '1.5.4', 'B', '解决当用户观战后再重新登录时，提示『会话信息过期』的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (91, '1.5.5', 'A', '新增观战时可交换棋盘(红方视角或黑方视角)', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (92, '1.6.0', 'A', '新增对局人数、观战场次数展示', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (93, '1.6.1', 'B', '解决PC端对局时棋盘棋子无法选中的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (94, '1.6.2', 'A', '限制同IP短时间内重复注册，防止恶意注册', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (95, '1.6.2', 'M', '将游客和正式用户分开匹配', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (96, '1.6.2', 'M', '登录时使用浏览器指纹校验，增强账号安全性', 3, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (97, '1.6.2', 'M', '长捉功能针对单子强攻和多子围攻分别设定不同的可攻击次数', 4, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (98, '1.7.0', 'A', '新对局房间列表功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (99, '1.7.1', 'B', '解决用户在房间列表页面加入某个房间后，刷新页面并登录时，无法正确的进入房间列表的问题', 1, NULL,
        '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (100, '1.7.2', 'M', '加密接口数据', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (101, '1.7.3', 'A', '新增换肤功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (102, '1.7.4', 'A', '新增观战用户可聊天功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (103, '1.8.0', 'M', '利用Canvas替换复盘、观战、对局的棋盘以及动画', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (104, '1.8.1', 'A', '对局、观战界面增加数据ACK机制', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (105, '2.0.0', 'A', '棋盘的内容存储按国际象棋标准调整(FEN格式)', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (106, '2.0.1', 'A', '新增局时用尽后的步时读秒功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (107, '2.0.2', 'M', '接口出入参优化', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (108, '2.0.3', 'B', '数据断连调用方案，改成服务端发起', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (109, '2.0.3', 'M', '复盘列表优化', 2, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (110, '2.0.3', 'M', '修复纯数字账号登录时不能走棋的问题', 3, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (111, '2.0.3', 'A', '注册增加验证码校验', 4, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (112, '2.0.3', 'A', '新增房间踢人功能', 5, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (113, '2.0.4', 'M', '棋盘渲染性能优化', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (114, '2.0.4', 'M', '代码review，部分功能利用本地数据计算，如：观战时换对手视角', 2, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (115, '2.0.4', 'M', '部分事件改成服务器主动下发，如：房间数据变更、对战数据变更', 3, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (116, '2.0.4', 'M', '对局时间调整成服务端下发', 4, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (117, '2.0.4', 'A', '邀请功能开发', 5, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (118, '2.0.4', 'M', '放开游客不能与正式用户匹配的限制', 6, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (119, '2.0.4', 'M', '解决部分机型闪屏的问题', 7, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (120, '2.0.5.b1', 'A', '新增头像上传功能', 1, NULL, '2025-03-20 23:46:32', '2025-03-20 23:46:32');
INSERT INTO `t_version_detail` (`id`, `version_id`, `change_type`, `content`, `sort`, `style`, `create_time`,
                                `update_time`)
VALUES (121, '2.0.5.b2', 'B', '修复用户加入观战时，有时未同步到最新棋局信息的问题', 1, NULL, '2025-03-20 23:46:32',
        '2025-03-20 23:46:32');
COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
