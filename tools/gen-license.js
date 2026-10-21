#!/usr/bin/env node
/**
 * 定投 (lldca) 授权码生成器 — 命令行版
 * 用法：
 *   node gen-license.js <设备识别码>     由设备码生成授权码
 *   node gen-license.js --new            随机生成一对「设备码 + 授权码」（测试用）
 * 设备识别码在 App 首次启动的激活页显示（12 位十六进制，如 4F2A9C1B7D3E）。
 */
'use strict';

const path = require('path');
const api = require(path.join(__dirname, '..', 'www', 'app.js'));

const args = process.argv.slice(2);

function usage() {
  console.log('定投 (lldca) 授权码生成器');
  console.log('  用法: node gen-license.js <设备识别码>   由设备码生成授权码');
  console.log('        node gen-license.js --new         随机生成设备码+授权码（测试）');
  process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
}

if (!args.length) usage();

if (args[0] === '--new' || args[0] === '-n') {
  const dev = api.genDeviceId();
  const code = api.licenseCodeFor(dev);
  console.log('设备识别码: ' + dev);
  console.log('授权码:     ' + code);
  console.log('自校验:     ' + (api.verifyCode(code, dev) ? 'OK' : 'FAIL'));
} else {
  const dev = String(args[0]).toUpperCase().replace(/[^0-9A-F]/g, '');
  if (!/^[0-9A-F]{12}$/.test(dev)) {
    console.error('错误: 设备识别码应为 12 位十六进制字符（App 激活页显示）');
    process.exit(1);
  }
  const code = api.licenseCodeFor(dev);
  console.log('设备识别码: ' + dev);
  console.log('授权码:     ' + code);
  console.log('自校验:     ' + (api.verifyCode(code, dev) ? 'OK' : 'FAIL'));
}
