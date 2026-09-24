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
require('../lib/migrate').migrate(db);


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
    ['만들기','향수','나만의 시그니처 향수 만들기','🧴','동성로','2시간',39000,1,'운영','좋아하는 향을 조합해 한 병의 취향을 완성해요.','향수를 고를 때마다 "좋은데 왜 좋은지 모르겠다"는 생각이 들었다면, 이 모임에서 그 이유를 찾아봐요.\n\n시트러스·플로럴·우디·머스크처럼 향의 계열을 먼저 가볍게 익히고, 원료 20여 종을 직접 맡아보며 내가 끌리는 향을 골라요. 마음에 드는 원료가 정해지면 비율을 바꿔가며 블렌딩해 30ml 한 병을 완성합니다.\n\n세 명이 한 테이블에 앉아 서로의 향을 맡아보는 시간이 가장 즐거운 순간이에요. 향을 잘 몰라도 괜찮아요.'],
    ['배우기','드로잉','카페에서 시작하는 펜 드로잉','✏️','삼덕동','1시간 50분',32000,1,'운영','그림을 못 그려도 괜찮은 한 장 드로잉.','"그림은 학교 이후로 처음"인 분들이 가장 많이 오는 모임이에요.\n\n지우개 없이 펜 한 자루로 선을 긋는 연습부터 시작해요. 컵이나 화분 같은 작은 사물을 그려보고, 마지막에는 카페의 한 구석을 한 장에 담습니다. 잘 그리는 것보다 오래 보는 법을 배우는 시간이에요.\n\n완성한 드로잉북은 가져가서 여행이나 일상에서 계속 채워보세요.'],
    ['배우기','커피','원두 취향 찾기 & 핸드드립','☕','교동','2시간',41000,1,'운영','산미와 고소함, 내 커피 취향을 직접 찾아봐요.','카페에서 "산미 있는 걸로 주세요"라고 말하지만 정확히 어떤 맛인지 설명하기 어렵다면 이 모임이 맞아요.\n\n산지가 다른 원두 세 가지를 나란히 맛보며 산미·단맛·바디감을 비교하고, 분쇄도와 물 온도를 바꿔 같은 원두가 어떻게 달라지는지 직접 확인해요. 마지막엔 각자 핸드드립으로 한 잔을 완성합니다.\n\n마음에 든 원두 100g을 가져가 집에서도 같은 레시피로 내려볼 수 있어요.'],
    ['만들기','가죽공예','가죽 키링과 카드태그 만들기','🧷','봉산동','2시간 20분',46000,1,'운영','색을 고르고 직접 각인하는 작은 가죽 소품.','매일 들고 다니는 물건 하나쯤은 직접 만든 것이면 좋겠다는 생각으로 시작한 모임이에요.\n\n미리 재단해 둔 베지터블 가죽 중에서 색을 고르고, 실 색과 이니셜 각인 위치를 정해요. 구멍을 뚫고 두 개의 바늘로 한 땀씩 꿰매는 새들 스티치를 배워 키링과 카드태그를 완성합니다.\n\n손바느질이 처음이어도 최대 세 명이라 단계마다 옆에서 도와드려요.'],
    ['배우기','사진','필름카메라 골목 산책','📷','김광석길','2시간 30분',35000,0,'일시중지','한 롤을 천천히 채우며 동네를 다르게 보는 시간.','필름카메라 기본 조작을 배우고 김광석길 골목을 걸으며 빛과 구도를 연습해요. 한 롤을 천천히 채우다 보면 익숙한 동네가 다르게 보여요. 현재 다음 일정 준비로 모집을 잠시 쉬고 있어요.']
  ];
  const gids = groupDefs.map(g => Number(insGroup.run(...g).lastInsertRowid));

  const detailDefs = [
    { host:['무드랩 · 윤가람','조향 클래스 5년'],
      bio:'향수 브랜드 연구실에서 5년간 일하다 동성로에 작은 조향 공방을 열었어요. 비싼 원료보다 "내가 왜 이 향을 좋아하는지" 알아가는 과정을 더 중요하게 생각해요. 세 명이 한 테이블에 앉으면 서로의 향을 맡아보며 이야기가 자연스럽게 이어져요.',
      order:['20분|향의 계열과 노트 구조 알아보기','30분|원료 20여 종 시향하고 고르기','50분|나만의 비율로 블렌딩하기','20분|라벨 작성·포장하고 서로의 향 맡아보기'],
      prep:['향수 시향이 편한 복장','향료 알레르기가 있다면 신청 이유에 적어주세요'],
      forWhom:['향수는 좋아하지만 어떤 계열이 나에게 맞는지 모르는 분','선물용이 아니라 나를 위한 향을 갖고 싶은 분','퇴근 후 조용히 몰입할 두 시간이 필요한 분'],
      includes:['원료 20여 종 시향','30ml 향수 1병 (공병·라벨 포함)','나만의 배합표 카드'],
      feeNote:'재료비·30ml 공병 포함',
      placeNote:'동성로 무드랩 2층 · 건물 주차 불가 · 중앙로역 3번 출구 도보 4분',
      refund:'',
      faq:[['향을 잘 몰라도 되나요?','처음인 분 기준으로 계열 설명부터 천천히 진행해요.'],['완성품은 가져가나요?','30ml 향수 한 병을 당일 포장해서 가져가요.'],['혼자 신청해도 되나요?','대부분 혼자 오세요. 최대 세 명이라 금방 대화가 시작돼요.']],
      cover:'/assets/img/groups/perfume-cover.jpg', gallery:['/assets/img/groups/perfume-1.jpg','/assets/img/groups/perfume-2.jpg','/assets/img/groups/perfume-3.jpg','/assets/img/groups/perfume-4.jpg'] },
    { host:['페이지카페 · 오하린','드로잉 클래스 4년'],
      bio:'삼덕동에서 작은 카페를 하며 손님들 모습을 드로잉북에 기록해 왔어요. 그림은 잘 그리는 것보다 오래 보는 게 먼저라고 생각해요. 펜 한 자루만 있으면 어디서든 시작할 수 있다는 걸 알려드리고 싶어요.',
      order:['20분|펜 잡는 법과 선 긋기','30분|컵·화분 같은 작은 사물 스케치','50분|카페 한 구석을 한 장에 담기','10분|서로의 그림 보며 이야기'],
      prep:['없어요 (도구 모두 제공)'],
      forWhom:['그림은 학창 시절 이후로 처음인 분','여행이나 일상을 사진 말고 다른 방식으로 기록하고 싶은 분','잘하는 것보다 꾸준히 하는 취미를 찾는 분'],
      includes:['0.3mm·0.5mm 드로잉 펜 2자루','A5 드로잉북 (가져가요)','음료 1잔'],
      feeNote:'펜·드로잉북·음료 1잔 포함',
      placeNote:'삼덕동 페이지카페 창가 테이블 · 주차 불가',
      refund:'',
      faq:[['그림을 못 그려도 되나요?','선 긋기부터 시작하는 초보자 과정이에요.'],['개인 도구를 가져가도 되나요?','물론이에요. 쓰던 펜이 있다면 함께 가져오세요.']],
      cover:'/assets/img/groups/drawing-cover.jpg', gallery:['/assets/img/groups/drawing-1.jpg','/assets/img/groups/drawing-2.jpg'] },
    { host:['로스터리 소담 · 김현우','바리스타 7년'],
      bio:'교동 골목에서 작은 로스터리를 운영해요. 손님마다 "산미"라는 말을 다르게 쓰는 게 재미있어서 이 모임을 열었어요. 정답 대신 내 입에 맞는 기준을 찾아가는 시간이 되면 좋겠어요.',
      order:['20분|세 가지 원두 향 맡고 맛 비교','30분|분쇄도·물 온도에 따라 달라지는 맛','50분|직접 핸드드립 3회 실습','20분|나만의 레시피 카드 정리'],
      prep:['카페인에 민감하다면 신청 이유에 적어주세요 (디카페인 준비)'],
      forWhom:['카페에서 늘 같은 메뉴만 고르게 되는 분','집에서 핸드드립을 시작해 보고 싶은 분','산미·바디감 같은 말을 직접 맛으로 확인하고 싶은 분'],
      includes:['원두 3종 시음','직접 내린 핸드드립 커피','마음에 든 원두 100g','레시피 카드'],
      feeNote:'원두 100g·시음 포함',
      placeNote:'교동 로스터리 소담 1층 · 주차 1대 가능 (신청 이유에 미리 적어주세요) · 대구역 도보 7분',
      refund:'',
      faq:[['디카페인도 가능한가요?','미리 알려주시면 디카페인 원두로 준비해요.'],['도구를 사야 하나요?','모든 도구는 현장에 준비되어 있어요.']],
      cover:'/assets/img/groups/coffee-cover.jpg', gallery:['/assets/img/groups/coffee-1.jpg','/assets/img/groups/coffee-2.jpg','/assets/img/groups/coffee-3.jpg'] },
    { host:['스튜디오 결 · 서지민','가죽공예 6년'],
      bio:'봉산문화거리에서 가죽 소품을 만들고 있어요. 기계 박음질보다 느리지만 오래가는 손바느질을 좋아해요. 처음 바늘을 잡는 분도 두 시간이면 매일 쓰는 물건 하나를 완성할 수 있어요.',
      order:['15분|가죽과 도구 소개','25분|가죽·실 색 고르고 각인 위치 정하기','80분|새들 스티치로 키링·카드태그 만들기','20분|모서리 마감과 포장'],
      prep:['없어요 (재료·도구 모두 제공)'],
      forWhom:['손으로 무언가를 끝까지 완성해 보고 싶은 분','선물할 작은 소품을 직접 만들고 싶은 분','조용히 집중하는 시간을 좋아하는 분'],
      includes:['베지터블 가죽 키링·카드태그 1세트','이니셜 각인','포장 파우치'],
      feeNote:'가죽·도구·각인·포장 포함',
      placeNote:'봉산동 스튜디오 결 3층 · 엘리베이터 없음 · 봉산문화거리 안',
      refund:'',
      faq:[['손바느질이 처음인데 괜찮나요?','최대 세 명이라 단계마다 옆에서 도와드려요.'],['각인 글자는 몇 자까지 되나요?','영문 이니셜 3자까지 가능해요.']],
      cover:'/assets/img/groups/leather-cover.jpg', gallery:['/assets/img/groups/leather-1.jpg','/assets/img/groups/leather-2.jpg','/assets/img/groups/leather-3.jpg'] },
    { host:['필름워크 · 한도윤','필름사진 워크숍 5년'],
      bio:'김광석길 근처에서 필름 현상소를 겸한 작은 작업실을 운영해요. 한 롤에 36장뿐이라 한 장 한 장 오래 고민하게 되는 게 필름의 매력이에요.',
      order:['20분|카메라 조작과 노출 기본','20분|빛과 구도 이야기','90분|김광석길 골목 촬영 산책','20분|카페에서 한 롤 정리하며 이야기'],
      prep:['편한 신발','개인 필름카메라가 있으면 지참'],
      forWhom:['휴대폰 말고 다른 카메라로 찍어보고 싶은 분','천천히 걷는 산책을 좋아하는 분'],
      includes:['필름카메라 대여','컬러 필름 1롤','현상·스캔 (1주 후 파일 전송)'],
      feeNote:'카메라 대여·필름·현상 포함',
      placeNote:'김광석길 입구 집결 · 우천 시 일정 변경',
      refund:'',
      faq:[['카메라가 없어도 되나요?','대여 장비가 준비되어 있어요.']],
      cover:'/assets/img/groups/film-cover.jpg', gallery:['/assets/img/groups/film-1.jpg','/assets/img/groups/film-2.jpg','/assets/img/groups/film-3.jpg'] },
  ];
  const hostPhotos=['perfume','drawing','coffee','leather','film'];
  const updDetail=db.prepare('UPDATE groups SET host_name=?,host_role=?,host_photo_url=?,host_bio=?,order_json=?,prep_json=?,for_whom_json=?,includes_json=?,fee_note=?,place_note=?,refund_policy=?,faq_json=?,cover_url=?,gallery_json=? WHERE id=?');
  detailDefs.forEach((d,i)=>updDetail.run(d.host[0],d.host[1],`/assets/img/hosts/${hostPhotos[i]}.jpg`,d.bio,json(d.order),json(d.prep),json(d.forWhom),json(d.includes),d.feeNote,d.placeNote,d.refund,json(d.faq),d.cover,json(d.gallery),gids[i]));

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
  addS('coffeePast1',gids[2],-13,'19:30','21:30','교동 로스터리 소담',41000,1,0);
  addS('coffeePast2',gids[2],-20,'14:00','16:00','교동 로스터리 소담',41000,1,0);
  addS('leatherPast',gids[3],-16,'18:30','20:50','봉산동 스튜디오 결',46000,1,0);
  addS('drawingPast',gids[1],-18,'15:00','16:50','삼덕동 페이지카페',32000,1,0);

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

  const insReview = db.prepare(`INSERT INTO reviews(application_id,satisfaction,revisit,progress,place,value,text,report,report_text,publish_ok,submitted_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  insReview.run(a10,5,5,4,4,5,'카메라를 거의 처음 써봤는데 설명이 쉬웠고 산책 코스도 좋았어요.',0,'',1,sqlDateTime(-6,20,15));
  insReview.run(a13,4,4,5,5,4,'향을 여러 번 비교해볼 수 있어서 좋았어요. 선택 시간이 조금 더 길면 좋겠습니다.',0,'',1,sqlDateTime(-9,18,40));
  // 지난 모임 참석자와 후기 (scores: 만족도, 재참여, 진행, 장소, 가격 / pub: 공개 동의)
  const past = (gid,sid,off,rows) => rows.forEach(([name,age,job,mbti,phone,scores,text,pub]) => {
    const id = addA(gid,sid,name,age,job,mbti,phone,'인스타그램',['평일 저녁'],'직접','평가완료',sqlDateTime(off-3,12,0),{approved_at:sqlDateTime(off-2,10,0),participation_confirmed_at:sqlDateTime(off-2,10,30),paid_at:sqlDateTime(off-2,13,0),attendance:'참석'});
    insReview.run(id,...scores,text,0,'',pub,sqlDateTime(off,21,40));
  });
  past(gids[2],schedules.coffeePast1,-13,[
    ['이수빈',26,'직장인','INFP','010-3321-4410',[5,5,5,4,5],'같은 원두인데 물 온도만 바꿨을 뿐인데 맛이 완전히 달라서 놀랐어요. 집에서 내려 마실 자신감이 생겼습니다.',1],
    ['조현준',30,'직장인','ISTJ','010-7710-2285',[5,4,5,5,4],'세 명이라 질문을 편하게 할 수 있었어요. 원두 100g 챙겨주신 것도 좋았습니다.',1]]);
  past(gids[2],schedules.coffeePast2,-20,[
    ['한예린',24,'대학생','ENFJ','010-5540-1937',[4,4,4,5,4],'산미를 싫어하는 줄 알았는데 제가 싫어했던 건 신맛이 아니라 떫은맛이었더라고요.',1],
    ['김태오',29,'직장인','INTP','010-6612-8804',[5,5,4,4,5],'',0]]);
  past(gids[3],schedules.leatherPast,-16,[
    ['박소율',27,'직장인','ISFP','010-2287-5519',[5,5,5,5,4],'바느질이 이렇게 차분해지는 일인 줄 몰랐어요. 키링은 매일 들고 다녀요.',1],
    ['윤지호',31,'직장인','ESTP','010-9031-6627',[5,4,5,4,4],'각인 위치까지 같이 고민해 주셔서 선물용으로 딱 좋았습니다.',1]]);
  past(gids[1],schedules.drawingPast,-18,[
    ['정다은',23,'대학생','INFJ','010-4478-2016',[5,5,4,5,5],'그림을 못 그린다고 생각했는데 한 장을 끝까지 완성했어요. 드로잉북은 계속 채우는 중이에요.',1],
    ['최민호',28,'직장인','ENTP','010-8124-3350',[4,4,4,5,4],'창가 자리에서 그리는 시간이 좋았어요. 조금 더 길었으면 싶을 정도.',1]]);
  past(gids[0],schedules.perfumePast,-9,[
    ['강하늘',25,'직장인','ENFP','010-3905-7741',[5,5,5,4,4],'제가 우디 계열을 좋아하는 이유를 처음 알았어요. 향수 이름을 직접 붙이는 것도 즐거웠습니다.',1]]);

  // 데모 신청 이유 (운영자가 승인할 때 참고하는 문답)
  const MOTIVATIONS = ['퇴근 후에 핸드폰 말고 손으로 뭔가 하는 시간을 갖고 싶어서 신청했어요.','혼자 배우기엔 막막했는데 소규모라 질문하기 편할 것 같아요.','친구에게 줄 선물을 직접 만들어 보고 싶어요.','대구로 이사 온 지 얼마 안 돼서 새로운 사람들과 이야기해 보고 싶어요.','예전부터 관심은 있었는데 시작할 계기가 없었어요. 이번에 꼭 해보고 싶습니다.','주말에 조용히 집중할 수 있는 취미를 찾고 있어요.'];
  const setMotivation = db.prepare('UPDATE applications SET motivation=? WHERE id=?');
  db.prepare('SELECT id FROM applications ORDER BY id').all().forEach((r,i)=>setMotivation.run(MOTIVATIONS[i%MOTIVATIONS.length],r.id));

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
console.log(`모임체 ${result.groupIds.length}개, 지난 모임 후기를 포함한 데모 데이터`);
