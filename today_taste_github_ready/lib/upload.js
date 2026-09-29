'use strict';
// 운영콘솔 사진 업로드. 파일은 DB 옆 uploads/ 폴더(코드와 분리, Docker 볼륨)에 저장하고 /uploads/파일명 으로 제공한다.
// 저장 위치를 S3 같은 외부 저장소로 옮길 때는 saveImage 만 바꾸면 된다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

// 확장자·Content-Type 은 믿지 않고 파일 앞부분(시그니처)으로 JPG·PNG·WebP 만 인정한다. SVG 는 스크립트를 담을 수 있어 받지 않는다.
function imageExt(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// 올린 사람이 정한 파일 이름은 쓰지 않는다(덮어쓰기·경로 조작 방지).
function saveImage(dir, buf, ext) {
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return { name, url: '/uploads/' + name };
}

module.exports = { UPLOAD_MAX_BYTES, imageExt, saveImage };
