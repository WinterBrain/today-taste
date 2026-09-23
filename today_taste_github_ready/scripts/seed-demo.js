'use strict';

process.env.TZ = 'Asia/Seoul';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || 'data/today_taste.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
for (const [name,def] of [['host_name',"TEXT NOT NULL DEFAULT ''"],['host_role',"TEXT NOT NULL DEFAULT ''"],['order_json',"TEXT NOT NULL DEFAULT '[]'"],['prep_json',"TEXT NOT NULL DEFAULT '[]'"],['refund_policy',"TEXT NOT NULL DEFAULT ''"],['faq_json',"TEXT NOT NULL DEFAULT '[]'"]]) {
  const cols=db.prepare('PRAGMA table_info(groups)').all().map(x=>x.name);
  if(!cols.includes(name)) db.exec(`ALTER TABLE groups ADD COLUMN ${name} ${def}`);
}


const reset = process.argv.includes('--reset');
const existing = db.prepare('SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM groups) groups').get();
if ((existing.users || existing.groups) && !reset) {
  console.error('DB에 기존 데이터가 있습니다. 데모 데이터로 초기화하려면: node scripts/seed-demo.js --reset');
  process.exit(1);
}

const isoDate = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const sqlDateTime = (offsetDays, hour, minute = 0) => `${isoDate(offsetDays)} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
const token = () => crypto.randomBytes(18).toString('hex');
const json = (v) => JSON.stringify(v);
const hash = (pw) => bcrypt.hashSync(pw, 12);

const ADMIN_PASSWORD = 'Taste!2026';
const OP_PASSWORD = 'TasteOp!2026';

const seed = db.transaction(() => {
  if (reset) {
    db.exec(`
      DELETE FROM audit_logs;
      DELETE FROM notifications;
      DELETE FROM reviews;
      DELETE FROM refunds;
      DELETE FROM applications;
      DELETE FROM schedules;
      DELETE FROM operator_groups;
      DELETE FROM groups;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name IN ('users','groups','schedules','applications','refunds','reviews','notifications','audit_logs');
    `);
  }

  const insUser = db.prepare(`INSERT INTO users(name,username,password_hash,role,active,must_change_password,last_login)
    VALUES(?,?,?,?,?,?,?)`);
  const adminId = Number(insUser.run('정유림', 'tasteadmin', hash(ADMIN_PASSWORD), 'admin', 1, 0, sqlDateTime(-1, 18, 20)).lastInsertRowid);
  const op1 = Number(insUser.run('강서윤', 'seoyun', hash(OP_PASSWORD), 'operator', 1, 0, sqlDateTime(-2, 20, 5)).lastInsertRowid);
  const op2 = Number(insUser.run('이민재', 'minjae', hash(OP_PASSWORD), 'operator', 1, 1, null).lastInsertRowid);
  const op3 = Number(insUser.run('한지우', 'jiwoo', hash(OP_PASSWORD), 'operator', 1, 0, sqlDateTime(-3, 11, 42)).lastInsertRowid);

  const insGroup = db.prepare(`INSERT INTO groups(field,tag,name,icon,place,duration,fee,exposed,status,tagline,intro)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  const groupDefs = [
    ['만들기','향수','나만의 시그니처 향수 만들기','🧴','동성로','2시간',39000,1,'운영','좋아하는 향을 조합해 한 병의 취향을 완성해요.','향의 계열을 가볍게 배우고 여러 원료를 직접 맡아본 뒤 나만의 30ml 향수를 만드는 소규모 클래스입니다.'],
    ['배우기','드로잉','카페에서 시작하는 펜 드로잉','✏️','삼덕동','1시간 50분',32000,1,'운영','그림을 못 그려도 괜찮은 한 장 드로잉.','선 긋기부터 시작해 카페 소품과 작은 풍경을 펜으로 기록합니다. 준비물은 모두 제공됩니다.'],
    ['배우기','커피','원두 취향 찾기 & 핸드드립','☕','교동','2시간',41000,1,'운영','산미와 고소함, 내 커피 취향을 직접 찾아봐요.','세 가지 원두를 비교하고 추출 변수를 바꿔가며 각자 한 잔을 완성하는 체험형 클래스입니다.'],
    ['만들기','가죽공예','가죽 키링과 카드태그 만들기','🧷','봉산동','2시간 20분',46000,1,'운영','색을 고르고 직접 각인하는 작은 가죽 소품.','가죽 색과 실을 고른 뒤 재단된 가죽에 각인과 손바느질을 더해 키링과 카드태그를 만듭니다.'],
    ['배우기','사진','필름카메라 골목 산책','📷','김광석길','2시간 30분',35000,0,'일시중지','한 롤을 천천히 채우며 동네를 다르게 보는 시간.','필름카메라 기본 조작을 배우고 골목을 걸으며 빛과 구도를 연습합니다. 현재 다음 일정 준비로 노출을 잠시 중지했습니다.']
  ];
  const gids = groupDefs.map(g => Number(insGroup.run(...g).lastInsertRowid));

  const detailDefs = [
    ['무드랩 · 윤가람','향 조향 클래스 5년',['향의 계열과 베이스 노트 알아보기','여러 원료 시향하기','나만의 비율로 블렌딩하기','라벨 작성과 포장'],['향수 시향이 편한 복장','알레르기가 있다면 사전 안내'],'모임 4일 전까지 전액 환불, 이후에는 재료 준비로 환불이 제한될 수 있어요.',[['향을 잘 몰라도 되나요?','처음인 분 기준으로 천천히 진행해요.'],['완성품은 가져가나요?','30ml 향수 한 병을 당일 가져가요.']]],
    ['페이지카페 · 오하린','드로잉 클래스 4년',['펜과 선 연습','간단한 사물 스케치','카페 풍경 한 장 완성','작품 공유와 정리'],['없음 (도구 제공)'],'모임 3일 전까지 전액 환불이 가능해요.',[['그림을 못 그려도 되나요?','초보자용 과정이라 괜찮아요.']]],
    ['로스터리 소담 · 김현우','바리스타 7년',['원두 향미 비교','분쇄도와 물 온도 알아보기','핸드드립 실습','나만의 레시피 기록'],['카페인에 민감하면 사전 안내'],'모임 3일 전까지 전액 환불이 가능해요.',[['디카페인도 가능한가요?','사전 요청 시 준비할 수 있어요.']]],
    ['스튜디오 결 · 서지민','가죽공예 6년',['가죽과 도구 소개','색상과 각인 고르기','손바느질','마감과 포장'],['없음 (재료·도구 제공)'],'모임 4일 전까지 전액 환불, 이후 재료 준비 비용이 발생할 수 있어요.',[['손바느질이 처음인데 괜찮나요?','최대 3인이라 단계마다 도와드려요.']]],
    ['필름워크 · 한도윤','필름사진 워크숍 5년',['카메라 기본 조작','빛과 구도 설명','골목 촬영 산책','촬영 결과 공유'],['편한 신발','개인 필름카메라가 있으면 지참'],'모임 3일 전까지 전액 환불이 가능해요.',[['카메라가 없어도 되나요?','대여 장비가 준비되어 있어요.']]]
  ];
  const updDetail=db.prepare('UPDATE groups SET host_name=?,host_role=?,order_json=?,prep_json=?,refund_policy=?,faq_json=? WHERE id=?');
  detailDefs.forEach((d,i)=>updDetail.run(d[0],d[1],json(d[2]),json(d[3]),d[4],json(d[5]),gids[i]));

  const assign = db.prepare('INSERT INTO operator_groups(user_id,group_id) VALUES(?,?)');
  assign.run(op1,gids[0]); assign.run(op1,gids[2]);
  assign.run(op2,gids[1]); assign.run(op2,gids[3]);
  assign.run(op3,gids[4]);

  const insSchedule = db.prepare(`INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee,cancelled,occurred)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  const schedules = {};
  const addS = (key, gid, off, start, end, place, fee, occurred=0, cancelled=0) => {
    schedules[key] = Number(insSchedule.run(gid,isoDate(off),start,end,place,3,fee,cancelled,occurred).lastInsertRowid);
  };
  addS('perfume1',gids[0],5,'14:00','16:00','동성로 무드랩 2층',39000);
  addS('perfume2',gids[0],12,'19:00','21:00','동성로 무드랩 2층',39000);
  addS('drawing1',gids[1],7,'15:00','16:50','삼덕동 페이지카페',32000);
  addS('coffee1',gids[2],4,'19:30','21:30','교동 로스터리 소담',41000);
  addS('coffee2',gids[2],10,'14:00','16:00','교동 로스터리 소담',41000);
  addS('leather1',gids[3],8,'18:30','20:50','봉산동 스튜디오 결',46000);
  addS('photoPast',gids[4],-6,'16:00','18:30','김광석길 입구 집결',35000,1,0);
  addS('perfumePast',gids[0],-9,'14:00','16:00','동성로 무드랩 2층',39000,1,0);

  const insApp = db.prepare(`INSERT INTO applications(
    group_id,schedule_id,name,age,job,mbti,phone,ad_source,preferred_times,selection_method,status,applied_at,approved_at,
    participation_token,participation_confirmed_at,payment_deadline,paid_at,attendance,review_token)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const addA = (gid,sid,name,age,job,mbti,phone,ad,times,method,status,applied,extra={}) => Number(insApp.run(
    gid,sid,name,age,job,mbti,phone,ad,json(times),method,status,applied,
    extra.approved_at||null,extra.participation_token||null,extra.participation_confirmed_at||null,
    extra.payment_deadline||null,extra.paid_at||null,extra.attendance||null,extra.review_token||null
  ).lastInsertRowid);

  const a1 = addA(gids[0],schedules.perfume1,'박서린',26,'직장인','ISFP','010-4312-7685','인스타그램',['토 오후','일 오후'],'직접','접수',sqlDateTime(-1,10,18));
  const a2 = addA(gids[0],schedules.perfume1,'윤태호',29,'직장인','ENFP','010-7821-3469','인스타그램',['평일 저녁','토 오후'],'랜덤','승인',sqlDateTime(-2,21,3),{approved_at:sqlDateTime(-1,9,30),participation_token:token()});
  const a3 = addA(gids[2],schedules.coffee1,'최나연',24,'대학생','INFJ','010-2294-8176','직접/기타',['평일 저녁'],'직접','입금대기',sqlDateTime(-2,13,25),{approved_at:sqlDateTime(-2,16,0),participation_confirmed_at:sqlDateTime(0,9,0),payment_deadline:sqlDateTime(0,19,0)});
  const a4 = addA(gids[2],schedules.coffee1,'문도현',28,'직장인','ISTP','010-6138-5502','인스타그램',['평일 저녁'],'직접','확정',sqlDateTime(-4,18,40),{approved_at:sqlDateTime(-4,20,0),participation_confirmed_at:sqlDateTime(-4,20,15),paid_at:sqlDateTime(-4,21,2)});
  const a5 = addA(gids[2],schedules.coffee1,'김예진',27,'직장인','ENFJ','010-9532-1844','인스타그램',['평일 저녁'],'직접','확정',sqlDateTime(-3,9,14),{approved_at:sqlDateTime(-3,11,0),participation_confirmed_at:sqlDateTime(-3,11,15),paid_at:sqlDateTime(-3,13,10)});
  const a6 = addA(gids[1],schedules.drawing1,'배하린',23,'대학생','INFP','010-3670-9215','페이스북',['토 오후','일 오후'],'랜덤','거절',sqlDateTime(-3,16,33));
  const a7 = addA(gids[3],schedules.leather1,'정우성',31,'직장인','ESTJ','010-5084-7732','직접/기타',['평일 저녁'],'직접','자동취소',sqlDateTime(-5,11,21),{approved_at:sqlDateTime(-5,14,0),participation_confirmed_at:sqlDateTime(-5,14,12)});
  const a8 = addA(gids[0],schedules.perfume2,'송가은',25,'직장인','ESFJ','010-8415-6203','인스타그램',['평일 저녁'],'직접','접수',sqlDateTime(0,8,42));
  const a9 = addA(gids[3],schedules.leather1,'임재훈',30,'직장인','INTJ','010-1764-9038','인스타그램',['평일 저녁','토 저녁'],'직접','확정',sqlDateTime(-4,12,50),{approved_at:sqlDateTime(-4,15,0),participation_confirmed_at:sqlDateTime(-4,15,4),paid_at:sqlDateTime(-4,17,22)});

  const a10 = addA(gids[4],schedules.photoPast,'오지민',26,'직장인','ENFP','010-6247-3518','인스타그램',['토 오후'],'직접','평가완료',sqlDateTime(-12,18,0),{approved_at:sqlDateTime(-11,10,0),participation_confirmed_at:sqlDateTime(-11,10,20),paid_at:sqlDateTime(-11,12,0),attendance:'참석'});
  const a11 = addA(gids[4],schedules.photoPast,'백승현',28,'직장인','ISTJ','010-3158-7490','직접/기타',['토 오후'],'직접','참석완료',sqlDateTime(-11,20,30),{approved_at:sqlDateTime(-10,9,20),participation_confirmed_at:sqlDateTime(-10,10,0),paid_at:sqlDateTime(-10,12,30),attendance:'참석',review_token:token()});
  const a12 = addA(gids[4],schedules.photoPast,'신채원',24,'대학생','ENTP','010-7993-1654','인스타그램',['토 오후'],'랜덤','불참',sqlDateTime(-10,14,4),{approved_at:sqlDateTime(-10,16,0),participation_confirmed_at:sqlDateTime(-10,16,10),paid_at:sqlDateTime(-10,17,10),attendance:'불참'});
  const a13 = addA(gids[0],schedules.perfumePast,'김소희',27,'직장인','ISFJ','010-2448-6831','인스타그램',['토 오후'],'직접','평가완료',sqlDateTime(-15,12,0),{approved_at:sqlDateTime(-14,10,0),participation_confirmed_at:sqlDateTime(-14,10,10),paid_at:sqlDateTime(-14,12,10),attendance:'참석'});
  const a14 = addA(gids[0],schedules.perfumePast,'류민석',29,'직장인','ENTJ','010-8872-4116','인스타그램',['토 오후'],'직접','환불필요',sqlDateTime(-14,13,0),{approved_at:sqlDateTime(-13,10,0),participation_confirmed_at:sqlDateTime(-13,10,5),paid_at:sqlDateTime(-8,13,10)});
  const a15 = addA(gids[1],schedules.drawing1,'서유나',22,'대학생','ENFP','010-5201-9347','인스타그램',['토 오후'],'직접','참여포기',sqlDateTime(-2,17,0),{approved_at:sqlDateTime(-2,19,0)});

  const insRefund = db.prepare('INSERT INTO refunds(application_id,reason,amount,status,created_at,processed_at) VALUES(?,?,?,?,?,?)');
  insRefund.run(a14,'정원 초과 후 입금',39000,'대기',sqlDateTime(-8,13,12),null);
  insRefund.run(a7,'입금 기한 후 수동 환불 요청',46000,'처리완료',sqlDateTime(-4,9,0),sqlDateTime(-3,15,30));

  const insReview = db.prepare(`INSERT INTO reviews(application_id,satisfaction,revisit,progress,place,value,text,report,report_text,submitted_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`);
  insReview.run(a10,5,5,4,4,5,'카메라를 거의 처음 써봤는데 설명이 쉬웠고 산책 코스도 좋았어요.',0,'',sqlDateTime(-6,20,15));
  insReview.run(a13,4,4,5,5,4,'향을 여러 번 비교해볼 수 있어서 좋았어요. 선택 시간이 조금 더 길면 좋겠습니다.',0,'',sqlDateTime(-9,18,40));

  const insNotif = db.prepare('INSERT INTO notifications(application_id,type,channel,payload,status,created_at) VALUES(?,?,?,?,?,?)');
  insNotif.run(a2,'approved','mock',json({note:'데모 승인 알림',participationPath:'일회용 링크 생성됨'}),'queued',sqlDateTime(-1,9,30));
  insNotif.run(a3,'payment_instruction','mock',json({note:'데모 입금 안내'}),'queued',sqlDateTime(0,9,0));

  const insAudit = db.prepare('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,detail,created_at) VALUES(?,?,?,?,?,?)');
  insAudit.run(adminId,'seed_demo','database','sample',json({accounts:4,groups:gids.length,applications:15}),sqlDateTime(0,10,0));

  return {adminId, operatorIds:[op1,op2,op3], groupIds:gids};
});

const result = seed();
console.log('샘플 데이터 입력 완료');
console.log('총괄자: tasteadmin / ' + ADMIN_PASSWORD);
console.log('운영자: seoyun / ' + OP_PASSWORD);
console.log('운영자: minjae / ' + OP_PASSWORD + ' (임시 비밀번호 표시 상태)');
console.log('운영자: jiwoo / ' + OP_PASSWORD);
console.log(`모임체 ${result.groupIds.length}개, 신청자 15명, 평가 2건, 환불 2건`);
