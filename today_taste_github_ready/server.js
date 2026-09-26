'use strict';
process.env.TZ = 'Asia/Seoul';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

function loadEnv(){
  const p = path.join(__dirname,'.env');
  if(!fs.existsSync(p)) return;
  for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m) continue;
    if(process.env[m[1]]===undefined) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
loadEnv();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me-please';
const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || './data/today_taste.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), {recursive:true});
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
// schema.sql 실행 + 기존 DB에 없는 컬럼 추가 (컬럼 목록은 lib/migrate.js 한 곳에서 관리)
require('./lib/migrate').migrate(db);
// 운영콘솔에서 올린 사진은 DB 옆 uploads/ 에 저장한다 (git 추적 안 함, Docker 에서는 ./data 볼륨에 보존)
const UPLOAD_DIR = path.join(path.dirname(DB_PATH),'uploads');
fs.mkdirSync(UPLOAD_DIR, {recursive:true});
const {UPLOAD_MAX_BYTES,imageExt,saveImage} = require('./lib/upload');


const app = express();
if(process.env.TRUST_PROXY==='1') app.set('trust proxy',1);
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:false}));
app.use(express.static(path.join(__dirname,'public')));
app.use('/uploads',express.static(UPLOAD_DIR,{index:false,setHeaders:r=>r.set('X-Content-Type-Options','nosniff')}));

const nowSql = () => db.prepare("SELECT datetime('now','localtime') AS now").get().now;
const token = () => crypto.randomBytes(24).toString('hex');
const parseJson = (v,f=[]) => { try { return JSON.parse(v||''); } catch(e) { return f; } };
const safeUser = r => r ? {id:r.id,name:r.name,username:r.username,role:r.role,active:!!r.active,mustChangePassword:!!r.must_change_password,lastLogin:r.last_login} : null;
const audit = (userId, action, entityType, entityId, detail={}) => db.prepare('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?)').run(userId||null,action,entityType,String(entityId??''),JSON.stringify(detail));
const notify = (applicationId,type,payload={}) => db.prepare('INSERT INTO notifications(application_id,type,payload,status) VALUES(?,?,?,?)').run(applicationId,type,JSON.stringify(payload),'queued');
// 이름 가림·직업 목록은 신청자 화면과 같은 규칙을 쓰도록 core.js 에서 가져온다
const {maskName,JOBS,NAME_MAX} = require('./public/assets/js/core.js');
const {LINK_VALID_SQL,purgeApplication,runRetention} = require('./lib/retention');
const scheduleError = b => !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date||''))||!/^\d{2}:\d{2}$/.test(String(b.start_time||''))||!/^\d{2}:\d{2}$/.test(String(b.end_time||'')) ? '날짜는 YYYY-MM-DD, 시간은 HH:MM 형식이어야 합니다.' : !String(b.place||'').trim() ? '장소가 필요합니다.' : !(Number.isInteger(Number(b.capacity))&&Number(b.capacity)>=1) ? '정원은 1명 이상이어야 합니다.' : !(Number(b.fee)>=0) ? '참가비는 0원 이상이어야 합니다.' : null;
const paymentInfo = () => process.env.PAYMENT_ACCOUNT ? {bank:process.env.PAYMENT_BANK||'',account:process.env.PAYMENT_ACCOUNT,holder:process.env.PAYMENT_HOLDER||''} : null;
const PUBLIC_REVIEW_WHERE = "r.publish_ok=1 AND r.hidden=0 AND trim(r.text)<>''";
const publicReviews = (extraWhere,params,limit) => db.prepare(`SELECT r.id,r.satisfaction rating,r.progress,r.place,r.value,r.text,r.submitted_at,a.name,a.group_id,g.name group_name,s.date FROM reviews r JOIN applications a ON a.id=r.application_id JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id WHERE ${PUBLIC_REVIEW_WHERE} AND g.exposed=1 AND g.status='운영' ${extraWhere} ORDER BY r.submitted_at DESC,r.id DESC LIMIT ${Number(limit)}`).all(...params).map(({name,...r})=>({...r,name_masked:maskName(name)}));

function auth(req,res,next){
  const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):null;
  if(!t) return res.status(401).json({error:'로그인이 필요합니다.'});
  try{
    const p=jwt.verify(t,JWT_SECRET); const u=db.prepare('SELECT * FROM users WHERE id=?').get(p.id);
    if(!u || !u.active) return res.status(401).json({error:'사용할 수 없는 계정입니다.'});
    req.user=u; next();
  }catch(e){ return res.status(401).json({error:'로그인이 만료되었습니다.'}); }
}
const adminOnly=(req,res,next)=> req.user.role==='admin'?next():res.status(403).json({error:'총괄자 권한이 필요합니다.'});
function canManageGroup(user, groupId){
  if(user.role==='admin') return true;
  return !!db.prepare('SELECT 1 FROM operator_groups WHERE user_id=? AND group_id=?').get(user.id,Number(groupId));
}
function requireGroup(req,res,next){ if(!canManageGroup(req.user,req.params.groupId||req.body.group_id||req.body.groupId)) return res.status(403).json({error:'담당 모임체만 처리할 수 있습니다.'}); next(); }

app.get('/api/health',(req,res)=>res.json({ok:true,time:nowSql(),database:path.basename(DB_PATH)}));
app.get('/api/auth/setup-status',(req,res)=>res.json({needsBootstrap:db.prepare('SELECT COUNT(*) c FROM users').get().c===0}));
app.post('/api/auth/bootstrap',async(req,res)=>{
  if(db.prepare('SELECT COUNT(*) c FROM users').get().c!==0) return res.status(409).json({error:'초기 관리자 계정이 이미 존재합니다.'});
  const {name,username,password}=req.body;
  if(!name||!username||!password||password.length<8) return res.status(400).json({error:'이름·아이디와 8자 이상 비밀번호가 필요합니다.'});
  const hash=await bcrypt.hash(password,12); const r=db.prepare("INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,'admin')").run(name.trim(),username.trim(),hash);
  audit(r.lastInsertRowid,'bootstrap_admin','user',r.lastInsertRowid); res.json({ok:true});
});
app.post('/api/auth/login',async(req,res)=>{
  const u=db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(String(req.body.username||'').trim());
  if(!u || !u.active || !(await bcrypt.compare(String(req.body.password||''),u.password_hash))) return res.status(401).json({error:'아이디 또는 비밀번호를 확인해 주세요.'});
  db.prepare("UPDATE users SET last_login=datetime('now','localtime') WHERE id=?").run(u.id);
  audit(u.id,'login','user',u.id); const access=jwt.sign({id:u.id,role:u.role},JWT_SECRET,{expiresIn:'10h'});
  res.json({token:access,user:safeUser({...u,last_login:nowSql()})});
});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.post('/api/auth/change-password',auth,async(req,res)=>{
  const {currentPassword,newPassword}=req.body; if(!newPassword||newPassword.length<8) return res.status(400).json({error:'새 비밀번호는 8자 이상이어야 합니다.'});
  if(!(await bcrypt.compare(String(currentPassword||''),req.user.password_hash))) return res.status(400).json({error:'현재 비밀번호가 맞지 않습니다.'});
  const hash=await bcrypt.hash(newPassword,12); db.prepare('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?').run(hash,req.user.id); audit(req.user.id,'change_password','user',req.user.id); res.json({ok:true});
});

app.get('/api/public/groups',(req,res)=>{
  const groups=db.prepare("SELECT * FROM groups WHERE exposed=1 AND status='운영' ORDER BY id DESC").all();
  const sched=db.prepare("SELECT s.*, (SELECT COUNT(*) FROM applications a WHERE a.schedule_id=s.id AND a.status IN ('확정','참석완료','평가완료')) confirmed FROM schedules s WHERE s.cancelled=0 AND datetime(s.date||' '||s.start_time)>datetime('now','localtime') ORDER BY s.date,s.start_time").all();
  const statRow=db.prepare(`SELECT (SELECT COUNT(*) FROM schedules s WHERE s.group_id=@id AND s.occurred=1 AND s.cancelled=0) sessions_done,(SELECT COUNT(*) FROM applications a WHERE a.group_id=@id AND a.status IN ('참석완료','평가완료')) participants,(SELECT ROUND(AVG(r.satisfaction),1) FROM reviews r JOIN applications a ON a.id=r.application_id WHERE a.group_id=@id AND ${PUBLIC_REVIEW_WHERE}) rating_avg,(SELECT COUNT(*) FROM reviews r JOIN applications a ON a.id=r.application_id WHERE a.group_id=@id AND ${PUBLIC_REVIEW_WHERE}) review_count`);
  const map=new Map(groups.map(g=>[g.id,{...g,exposed:!!g.exposed,schedules:[],stats:statRow.get({id:g.id}),reviews:publicReviews('AND a.group_id=?',[g.id],5)}]));
  sched.forEach(s=>{ if(map.has(s.group_id)) map.get(s.group_id).schedules.push({...s,remaining:Math.max(0,s.capacity-s.confirmed)}); });
  res.json({groups:[...map.values()],reviews:publicReviews('',[],8)});
});
app.get('/api/public/groups/:id/reviews',(req,res)=>res.json({reviews:publicReviews('AND a.group_id=?',[Number(req.params.id)],200)}));
app.post('/api/public/applications',(req,res)=>{
  const b=req.body; const s=db.prepare("SELECT s.*,g.exposed,g.status gstatus,(datetime(s.date||' '||s.start_time)<=datetime('now','localtime')) started,(SELECT COUNT(*) FROM applications a WHERE a.schedule_id=s.id AND a.status IN ('확정','참석완료','평가완료')) confirmed FROM schedules s JOIN groups g ON g.id=s.group_id WHERE s.id=?").get(Number(b.schedule_id));
  if(!s||s.cancelled||!s.exposed||s.gstatus!=='운영'||s.started) return res.status(400).json({error:'신청할 수 없는 일정입니다.'});
  if(s.confirmed>=s.capacity) return res.status(400).json({error:'이미 마감된 일정이에요. 다른 일정을 골라주세요.'});
  const name=String(b.name||'').trim(),age=Number(b.age),phone=String(b.phone||'').trim(),motivation=String(b.motivation||'').trim();
  if(!name||!b.job) return res.status(400).json({error:'이름과 직업을 입력해 주세요.'});
  if([...name].length>NAME_MAX) return res.status(400).json({error:`이름은 ${NAME_MAX}자 이내로 입력해 주세요.`});
  if(!JOBS.includes(b.job)) return res.status(400).json({error:'직업을 목록에서 골라주세요.'});
  if(!Number.isInteger(age)||age<19||age>35) return res.status(400).json({error:'만 19~35세만 신청할 수 있어요.'});
  if(!/^010-\d{4}-\d{4}$/.test(phone)) return res.status(400).json({error:'휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.'});
  if(motivation.length<10||motivation.length>300) return res.status(400).json({error:'신청 이유를 10자 이상 300자 이하로 적어주세요.'});
  try{
    const r=db.prepare(`INSERT INTO applications(group_id,schedule_id,name,age,job,mbti,phone,ad_source,preferred_times,selection_method,motivation,marketing_ok)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(s.group_id,s.id,name,age,String(b.job).trim(),String(b.mbti||'').toUpperCase().trim(),phone,String(b.ad_source||'직접/기타'),JSON.stringify(b.preferred_times||[]),String(b.selection_method||'직접'),motivation,b.marketing_ok?1:0);
    audit(null,'application_created','application',r.lastInsertRowid,{schedule_id:s.id}); res.json({ok:true,id:r.lastInsertRowid,status:'접수'});
  }catch(e){ if(String(e.message).includes('UNIQUE')) return res.status(409).json({error:'이미 이 일정에 같은 번호로 신청했어요. 신청 현황은 카카오톡 채널로 문의해 주세요.'}); throw e; }
});
app.get('/api/public/participation/:token',(req,res)=>{
  const a=db.prepare(`SELECT a.id,a.name,a.status,a.payment_deadline,CAST(ROUND((julianday(a.payment_deadline)-julianday('now','localtime'))*86400) AS INTEGER) payment_seconds_left,g.name group_name,g.cover_url,g.status group_status,s.cancelled,s.date,s.start_time,s.end_time,s.place,s.fee
    FROM applications a JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id WHERE a.participation_token=? AND ${LINK_VALID_SQL}`).get(req.params.token);
  if(!a) return res.status(404).json({error:'유효하지 않은 링크입니다.'}); const {cancelled,group_status,...rest}=a; res.json({...rest,schedule_cancelled:!!cancelled||group_status==='폐쇄',payment:paymentInfo()});
});
// 수락 후에도 입금 안내를 다시 볼 수 있도록 토큰을 유지한다. 수락/거절 처리는 '승인' 상태에서 한 번만 가능하다.
app.post('/api/public/participation/:token',(req,res)=>{
  const a=db.prepare(`SELECT a.*,s.fee,s.cancelled,g.status group_status,(datetime(s.date||' '||s.start_time)<=datetime('now','localtime')) started FROM applications a JOIN schedules s ON s.id=a.schedule_id JOIN groups g ON g.id=a.group_id WHERE a.participation_token=? AND ${LINK_VALID_SQL}`).get(req.params.token);
  if(!a||a.status!=='승인') return res.status(400).json({error:'이미 처리되었거나 유효하지 않은 링크입니다.'});
  if(req.body.accept!==false&&a.started) return res.status(400).json({error:'이미 시작한 모임이라 참여할 수 없어요.'});
  if(req.body.accept!==false&&(a.cancelled||a.group_status==='폐쇄')) return res.status(400).json({error:'일정이 취소되어 참여할 수 없어요. 카카오톡 채널로 문의해 주세요.'});
  if(req.body.accept===false){ db.prepare("UPDATE applications SET status='참여포기',participation_token=NULL WHERE id=?").run(a.id); notify(a.id,'participation_declined'); audit(null,'participation_declined','application',a.id); return res.json({ok:true,status:'참여포기'}); }
  db.prepare("UPDATE applications SET status='입금대기',participation_confirmed_at=datetime('now','localtime'),payment_deadline=datetime('now','localtime','+10 hours') WHERE id=?").run(a.id);
  notify(a.id,'payment_instruction',{manual:true}); audit(null,'participation_accepted','application',a.id); const n=db.prepare("SELECT a.payment_deadline,CAST(ROUND((julianday(a.payment_deadline)-julianday('now','localtime'))*86400) AS INTEGER) payment_seconds_left FROM applications a WHERE a.id=?").get(a.id); res.json({ok:true,status:'입금대기',paymentDeadline:n.payment_deadline,paymentSecondsLeft:n.payment_seconds_left,payment:paymentInfo(),fee:a.fee});
});
app.get('/participation/:token',(req,res)=>res.sendFile(path.join(__dirname,'public','participation.html')));

app.get('/api/admin/summary',auth,(req,res)=>{
  const where=req.user.role==='admin'?'1=1':'a.group_id IN (SELECT group_id FROM operator_groups WHERE user_id=@uid)';
  const counts=db.prepare(`SELECT status,COUNT(*) count FROM applications a WHERE ${where} GROUP BY status`).all({uid:req.user.id});
  res.json({counts:Object.fromEntries(counts.map(x=>[x.status,x.count]))});
});
app.get('/api/admin/applications',auth,(req,res)=>{
  const p=[]; let w=[];
  if(req.user.role!=='admin'){ w.push('a.group_id IN (SELECT group_id FROM operator_groups WHERE user_id=?)'); p.push(req.user.id); }
  if(req.query.status){w.push('a.status=?');p.push(req.query.status);} if(req.query.group_id){w.push('a.group_id=?');p.push(Number(req.query.group_id));}
  if(req.query.q){w.push('(a.name LIKE ? OR a.phone LIKE ?)');p.push('%'+req.query.q+'%','%'+req.query.q+'%');}
  const rows=db.prepare(`SELECT a.*,CAST(ROUND((julianday(a.payment_deadline)-julianday('now','localtime'))*86400) AS INTEGER) payment_seconds_left,(datetime(s.date||' '||s.start_time)<=datetime('now','localtime')) started,g.name group_name,g.icon,s.date,s.start_time,s.end_time,s.capacity,s.fee schedule_fee FROM applications a JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY a.id DESC`).all(...p);
  res.json({applications:rows.map(r=>({...r,preferred_times:JSON.parse(r.preferred_times||'[]')}))});
});
app.post('/api/admin/applications/:id/approve',auth,(req,res)=>{
  const a=db.prepare('SELECT * FROM applications WHERE id=?').get(Number(req.params.id)); if(!a) return res.status(404).json({error:'신청자를 찾을 수 없습니다.'});
  if(!canManageGroup(req.user,a.group_id)) return res.status(403).json({error:'담당 모임체만 승인할 수 있습니다.'}); if(a.status!=='접수') return res.status(400).json({error:'접수 상태만 승인할 수 있습니다.'});
  const t=token(); db.prepare("UPDATE applications SET status='승인',approved_at=datetime('now','localtime'),participation_token=? WHERE id=?").run(t,a.id); notify(a.id,'approved',{participationPath:'/participation/'+t}); audit(req.user.id,'approve_application','application',a.id); res.json({ok:true,participationPath:'/participation/'+t});
});
app.post('/api/admin/applications/:id/reject',auth,(req,res)=>{
  const a=db.prepare('SELECT * FROM applications WHERE id=?').get(Number(req.params.id)); if(!a) return res.status(404).json({error:'신청자를 찾을 수 없습니다.'}); if(!canManageGroup(req.user,a.group_id)) return res.status(403).json({error:'담당 모임체만 거절할 수 있습니다.'});
  db.prepare("UPDATE applications SET status='거절',participation_token=NULL WHERE id=?").run(a.id); notify(a.id,'rejected'); audit(req.user.id,'reject_application','application',a.id); res.json({ok:true});
});
const confirmPayment=db.transaction((appId,userId)=>{
  const a=db.prepare(`SELECT a.*,s.capacity,s.fee,s.cancelled FROM applications a JOIN schedules s ON s.id=a.schedule_id WHERE a.id=?`).get(appId);
  if(!a) throw new Error('NOT_FOUND'); if(a.status!=='입금대기') throw new Error('BAD_STATUS');
  if(a.cancelled){ db.prepare("UPDATE applications SET status='환불필요',paid_at=datetime('now','localtime') WHERE id=?").run(appId); db.prepare("INSERT INTO refunds(application_id,reason,amount) VALUES(?,'일정 취소 후 입금',?)").run(appId,a.fee); return '환불필요'; }
  const c=db.prepare("SELECT COUNT(*) c FROM applications WHERE schedule_id=? AND status IN ('확정','참석완료','평가완료')").get(a.schedule_id).c;
  if(c>=a.capacity){ db.prepare("UPDATE applications SET status='환불필요',paid_at=datetime('now','localtime') WHERE id=?").run(appId); db.prepare("INSERT INTO refunds(application_id,reason,amount) VALUES(?,'정원 초과 후 입금',?)").run(appId,a.fee); return '환불필요'; }
  db.prepare("UPDATE applications SET status='확정',paid_at=datetime('now','localtime'),payment_deadline=NULL WHERE id=?").run(appId); return '확정';
});
app.post('/api/admin/applications/:id/mark-paid',auth,(req,res)=>{
  const a=db.prepare('SELECT * FROM applications WHERE id=?').get(Number(req.params.id)); if(!a) return res.status(404).json({error:'신청자를 찾을 수 없습니다.'}); if(!canManageGroup(req.user,a.group_id)) return res.status(403).json({error:'담당 모임체만 처리할 수 있습니다.'});
  try{const status=confirmPayment(a.id,req.user.id);notify(a.id,status==='확정'?'payment_confirmed':'refund_required');audit(req.user.id,'mark_paid','application',a.id,{status});res.json({ok:true,status});}catch(e){return res.status(400).json({error:e.message==='BAD_STATUS'?'입금대기 상태만 입금 처리할 수 있습니다.':'처리할 수 없습니다.'});}
});
app.post('/api/admin/applications/:id/attendance',auth,(req,res)=>{
  const a=db.prepare('SELECT * FROM applications WHERE id=?').get(Number(req.params.id)); if(!a)return res.status(404).json({error:'신청자를 찾을 수 없습니다.'}); if(!canManageGroup(req.user,a.group_id))return res.status(403).json({error:'담당 모임체만 처리할 수 있습니다.'});
  // 확정 → 참석완료/불참. 잘못 누른 불참만 참석으로 되돌릴 수 있다(참석완료는 평가 링크가 나가므로 되돌리지 않는다)
  const allowed=req.body.attended?['확정','불참']:['확정']; if(!allowed.includes(a.status))return res.status(400).json({error:req.body.attended?'확정 또는 불참 상태만 참석 처리할 수 있습니다.':'확정 상태만 불참 처리할 수 있습니다.'});
  if(!db.prepare("SELECT datetime(date||' '||start_time)<=datetime('now','localtime') v FROM schedules WHERE id=?").get(a.schedule_id).v)return res.status(400).json({error:'모임이 시작된 뒤에 출석을 처리할 수 있습니다.'});
  const status=req.body.attended? '참석완료':'불참'; const rt=req.body.attended?token():null; db.prepare('UPDATE applications SET status=?,attendance=?,review_token=?,participation_token=NULL WHERE id=?').run(status,req.body.attended?'참석':'불참',rt,a.id); if(rt) notify(a.id,'review_request',{reviewPath:'/review/'+rt}); audit(req.user.id,'attendance','application',a.id,{status}); res.json({ok:true,status,reviewPath:rt?'/review/'+rt:null});
});

// 정보주체의 삭제 요청 처리. 입금 기록이 있으면 전자상거래법상 5년 보존 의무가 있어 거절한다(개인정보 보호법 제36조 제1항 단서)
app.post('/api/admin/applications/:id/purge',auth,adminOnly,(req,res)=>{
  const a=db.prepare('SELECT * FROM applications WHERE id=?').get(Number(req.params.id)); if(!a) return res.status(404).json({error:'신청자를 찾을 수 없습니다.'});
  if(a.paid_at) return res.status(400).json({error:'입금 기록이 있는 신청은 법령에 따라 5년간 보존해야 해서 파기할 수 없습니다. 마케팅 수신 동의만 철회할 수 있습니다.'});
  if(['승인','입금대기','확정'].includes(a.status)) return res.status(400).json({error:'진행 중인 신청은 먼저 거절 처리한 뒤 파기하세요.'});
  purgeApplication(db,a.id); audit(req.user.id,'purge_application','application',a.id); res.json({ok:true});
});
app.post('/api/admin/applications/:id/marketing-off',auth,adminOnly,(req,res)=>{db.prepare('UPDATE applications SET marketing_ok=0 WHERE id=?').run(Number(req.params.id));audit(req.user.id,'marketing_withdrawn','application',req.params.id);res.json({ok:true});});

app.get('/api/admin/groups',auth,(req,res)=>{
  const rows=req.user.role==='admin'?db.prepare('SELECT * FROM groups ORDER BY id DESC').all():db.prepare('SELECT g.* FROM groups g JOIN operator_groups og ON og.group_id=g.id WHERE og.user_id=? ORDER BY g.id DESC').all(req.user.id);
  const ops=db.prepare(`SELECT og.group_id,u.id,u.name,u.username FROM operator_groups og JOIN users u ON u.id=og.user_id WHERE u.active=1`).all(); const by={};ops.forEach(o=>(by[o.group_id]??=[]).push(o));res.json({groups:rows.map(g=>({...g,exposed:!!g.exposed,operators:by[g.id]||[]}))});
});
const GROUP_COLS='field,tag,name,icon,place,duration,fee,exposed,status,tagline,intro,host_name,host_role,order_json,prep_json,refund_policy,faq_json,cover_url,gallery_json,for_whom_json,includes_json,fee_note,host_bio,host_photo_url,place_note';
const groupValues=(b,g={})=>[b.field,b.tag||'',b.name,b.icon||g.icon||'✨',b.place||'',b.duration||'',Number(b.fee||0),b.exposed===false||b.exposed===0?0:1,b.status||'운영',b.tagline||'',b.intro||'',b.host_name||'',b.host_role||'',JSON.stringify(b.order||parseJson(g.order_json,[])),JSON.stringify(b.prep||parseJson(g.prep_json,[])),b.refund_policy||'',JSON.stringify(b.faq||parseJson(g.faq_json,[])),b.cover_url||'',JSON.stringify(b.gallery||parseJson(g.gallery_json,[])),JSON.stringify(b.for_whom||parseJson(g.for_whom_json,[])),JSON.stringify(b.includes||parseJson(g.includes_json,[])),b.fee_note||'',b.host_bio||'',b.host_photo_url||'',b.place_note||''];
// 사진 업로드: 요청 본문이 파일 그대로(Content-Type 은 image/*). 형식은 파일 앞부분으로 다시 확인한다
const rawImage=(req,res,next)=>express.raw({type:()=>true,limit:UPLOAD_MAX_BYTES})(req,res,e=>e?res.status(e.status===413?413:400).json({error:e.status===413?'사진은 5MB 이하만 올릴 수 있어요. 크기를 줄여서 다시 올려 주세요.':'사진을 읽지 못했어요. 다시 올려 주세요.'}):next());
app.post('/api/admin/uploads',auth,adminOnly,rawImage,(req,res)=>{const ext=imageExt(req.body);if(!ext)return res.status(400).json({error:'JPG·PNG·WebP 사진만 올릴 수 있어요. 다른 형식은 변환해서 올려 주세요.'});const f=saveImage(UPLOAD_DIR,req.body,ext);audit(req.user.id,'upload_image','upload',f.name,{size:req.body.length});res.json({ok:true,url:f.url});});
app.post('/api/admin/groups',auth,adminOnly,(req,res)=>{
  const b=req.body;if(!b.name||!b.field)return res.status(400).json({error:'모임체명과 분야가 필요합니다.'}); const r=db.prepare(`INSERT INTO groups(${GROUP_COLS}) VALUES(${GROUP_COLS.split(',').map(()=>'?').join(',')})`).run(...groupValues(b)); audit(req.user.id,'create_group','group',r.lastInsertRowid);res.json({ok:true,id:r.lastInsertRowid});
});
app.patch('/api/admin/groups/:id',auth,adminOnly,(req,res)=>{
  const g=db.prepare('SELECT * FROM groups WHERE id=?').get(Number(req.params.id));if(!g)return res.status(404).json({error:'모임체가 없습니다.'});const b={...g,...req.body};db.prepare(`UPDATE groups SET ${GROUP_COLS.split(',').map(c=>c+'=?').join(',')} WHERE id=?`).run(...groupValues(b,g),g.id);audit(req.user.id,'update_group','group',g.id);res.json({ok:true});
});
app.post('/api/admin/groups/:id/close',auth,adminOnly,(req,res)=>{
  const gid=Number(req.params.id); const tx=db.transaction(()=>{db.prepare("UPDATE groups SET status='폐쇄',exposed=0 WHERE id=?").run(gid);db.prepare('UPDATE schedules SET cancelled=1 WHERE group_id=?').run(gid);const affected=db.prepare("SELECT a.id,s.fee FROM applications a JOIN schedules s ON s.id=a.schedule_id WHERE a.group_id=? AND a.status='확정'").all(gid);for(const a of affected){db.prepare("UPDATE applications SET status='환불필요' WHERE id=?").run(a.id);db.prepare("INSERT INTO refunds(application_id,reason,amount) VALUES(?,'모임체 폐쇄',?)").run(a.id,a.fee);notify(a.id,'group_closed');}return affected.length;});const count=tx();audit(req.user.id,'close_group','group',gid,{refunds:count});res.json({ok:true,refundCount:count});
});
app.put('/api/admin/groups/:id/operators',auth,adminOnly,(req,res)=>{const gid=Number(req.params.id);const ids=(req.body.user_ids||[]).map(Number);const tx=db.transaction(()=>{db.prepare('DELETE FROM operator_groups WHERE group_id=?').run(gid);for(const uid of ids)db.prepare('INSERT OR IGNORE INTO operator_groups(user_id,group_id) VALUES(?,?)').run(uid,gid);});tx();audit(req.user.id,'assign_operators','group',gid,{user_ids:ids});res.json({ok:true});});

app.get('/api/admin/schedules',auth,(req,res)=>{
  const p=[];let w=[];if(req.user.role!=='admin'){w.push('s.group_id IN (SELECT group_id FROM operator_groups WHERE user_id=?)');p.push(req.user.id);}if(req.query.group_id){w.push('s.group_id=?');p.push(Number(req.query.group_id));}
  const rows=db.prepare(`SELECT s.*,g.name group_name,g.icon,(SELECT COUNT(*) FROM applications a WHERE a.schedule_id=s.id AND a.status IN ('확정','참석완료','평가완료')) confirmed FROM schedules s JOIN groups g ON g.id=s.group_id ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY s.date DESC,s.start_time`).all(...p);res.json({schedules:rows.map(x=>({...x,cancelled:!!x.cancelled,occurred:!!x.occurred}))});
});
app.post('/api/admin/schedules',auth,(req,res)=>{const b=req.body;if(!canManageGroup(req.user,b.group_id))return res.status(403).json({error:'담당 모임체만 일정을 만들 수 있습니다.'});const err=scheduleError({capacity:2,fee:0,...b});if(err)return res.status(400).json({error:err});const r=db.prepare('INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee) VALUES(?,?,?,?,?,?,?)').run(Number(b.group_id),b.date,b.start_time,b.end_time,b.place,Number(b.capacity||2),Number(b.fee||0));audit(req.user.id,'create_schedule','schedule',r.lastInsertRowid);res.json({ok:true,id:r.lastInsertRowid});});
app.patch('/api/admin/schedules/:id',auth,(req,res)=>{const s=db.prepare('SELECT * FROM schedules WHERE id=?').get(Number(req.params.id));if(!s)return res.status(404).json({error:'일정이 없습니다.'});if(!canManageGroup(req.user,s.group_id))return res.status(403).json({error:'담당 모임체만 수정할 수 있습니다.'});const b={...s,...req.body};const err=scheduleError(b);if(err)return res.status(400).json({error:err});db.prepare('UPDATE schedules SET date=?,start_time=?,end_time=?,place=?,capacity=?,fee=?,occurred=? WHERE id=?').run(b.date,b.start_time,b.end_time,b.place,Number(b.capacity),Number(b.fee),b.occurred?1:0,s.id);audit(req.user.id,'update_schedule','schedule',s.id);res.json({ok:true});});
app.post('/api/admin/schedules/:id/cancel',auth,(req,res)=>{const s=db.prepare('SELECT * FROM schedules WHERE id=?').get(Number(req.params.id));if(!s)return res.status(404).json({error:'일정이 없습니다.'});if(!canManageGroup(req.user,s.group_id))return res.status(403).json({error:'담당 모임체만 취소할 수 있습니다.'});const tx=db.transaction(()=>{db.prepare('UPDATE schedules SET cancelled=1 WHERE id=?').run(s.id);const arr=db.prepare("SELECT id FROM applications WHERE schedule_id=? AND status='확정'").all(s.id);for(const a of arr){db.prepare("UPDATE applications SET status='환불필요' WHERE id=?").run(a.id);db.prepare("INSERT INTO refunds(application_id,reason,amount) VALUES(?,'일정 취소',?)").run(a.id,s.fee);notify(a.id,'schedule_cancelled');}return arr.length;});const n=tx();audit(req.user.id,'cancel_schedule','schedule',s.id,{refunds:n});res.json({ok:true,refundCount:n});});

app.get('/api/admin/operators',auth,adminOnly,(req,res)=>{const users=db.prepare("SELECT id,name,username,role,active,must_change_password,last_login,created_at FROM users WHERE role='operator' ORDER BY id DESC").all();const og=db.prepare('SELECT user_id,group_id FROM operator_groups').all();res.json({operators:users.map(u=>({...u,active:!!u.active,must_change_password:!!u.must_change_password,group_ids:og.filter(x=>x.user_id===u.id).map(x=>x.group_id)}))});});
app.post('/api/admin/operators',auth,adminOnly,async(req,res)=>{const {name,username,password,group_ids=[]}=req.body;if(!name||!username||!password||password.length<8)return res.status(400).json({error:'이름·아이디와 8자 이상 임시 비밀번호가 필요합니다.'});try{const hash=await bcrypt.hash(password,12);const r=db.prepare("INSERT INTO users(name,username,password_hash,role,must_change_password) VALUES(?,?,?,'operator',1)").run(name.trim(),username.trim(),hash);for(const gid of group_ids)db.prepare('INSERT OR IGNORE INTO operator_groups(user_id,group_id) VALUES(?,?)').run(r.lastInsertRowid,Number(gid));audit(req.user.id,'create_operator','user',r.lastInsertRowid);res.json({ok:true,id:r.lastInsertRowid});}catch(e){if(String(e.message).includes('UNIQUE'))return res.status(409).json({error:'이미 사용 중인 아이디입니다.'});throw e;}});
app.patch('/api/admin/operators/:id',auth,adminOnly,(req,res)=>{const id=Number(req.params.id);if(req.body.active!==undefined)db.prepare('UPDATE users SET active=? WHERE id=? AND role=\'operator\'').run(req.body.active?1:0,id);if(Array.isArray(req.body.group_ids)){const tx=db.transaction(()=>{db.prepare('DELETE FROM operator_groups WHERE user_id=?').run(id);for(const gid of req.body.group_ids)db.prepare('INSERT OR IGNORE INTO operator_groups(user_id,group_id) VALUES(?,?)').run(id,Number(gid));});tx();}audit(req.user.id,'update_operator','user',id);res.json({ok:true});});
app.post('/api/admin/operators/:id/reset-password',auth,adminOnly,async(req,res)=>{if(!req.body.password||req.body.password.length<8)return res.status(400).json({error:'8자 이상 임시 비밀번호가 필요합니다.'});const hash=await bcrypt.hash(req.body.password,12);db.prepare('UPDATE users SET password_hash=?,must_change_password=1 WHERE id=? AND role=\'operator\'').run(hash,Number(req.params.id));audit(req.user.id,'reset_operator_password','user',req.params.id);res.json({ok:true});});

app.get('/api/admin/refunds',auth,adminOnly,(req,res)=>{const rows=db.prepare(`SELECT r.*,a.name,a.phone,g.name group_name,s.date,s.start_time FROM refunds r LEFT JOIN applications a ON a.id=r.application_id LEFT JOIN groups g ON g.id=a.group_id LEFT JOIN schedules s ON s.id=a.schedule_id ORDER BY r.id DESC`).all();res.json({refunds:rows});});
app.post('/api/admin/refunds/:id/complete',auth,adminOnly,(req,res)=>{db.prepare("UPDATE refunds SET status='처리완료',processed_at=datetime('now','localtime') WHERE id=?").run(Number(req.params.id));audit(req.user.id,'complete_refund','refund',req.params.id);res.json({ok:true});});
app.get('/api/admin/reviews',auth,adminOnly,(req,res)=>{const rows=db.prepare(`SELECT r.*,a.name applicant_name,g.name group_name FROM reviews r JOIN applications a ON a.id=r.application_id JOIN groups g ON g.id=a.group_id ORDER BY r.id DESC`).all();res.json({reviews:rows});});
app.patch('/api/admin/reviews/:id',auth,adminOnly,(req,res)=>{const r=db.prepare('SELECT id FROM reviews WHERE id=?').get(Number(req.params.id));if(!r)return res.status(404).json({error:'평가를 찾을 수 없습니다.'});db.prepare('UPDATE reviews SET hidden=? WHERE id=?').run(req.body.hidden?1:0,r.id);audit(req.user.id,req.body.hidden?'hide_review':'show_review','review',r.id);res.json({ok:true});});
app.get('/api/admin/notifications',auth,adminOnly,(req,res)=>res.json({notifications:db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 200').all()}));

app.get('/api/public/review/:token',(req,res)=>{const a=db.prepare(`SELECT a.id,a.name,a.status,g.name group_name,g.cover_url,s.date,s.start_time FROM applications a JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id WHERE a.review_token=?`).get(req.params.token);if(!a)return res.status(404).json({error:'유효하지 않은 링크입니다.'});res.json(a);});
app.post('/api/public/review/:token',(req,res)=>{const a=db.prepare('SELECT * FROM applications WHERE review_token=?').get(req.params.token);if(!a||a.status!=='참석완료')return res.status(400).json({error:'평가할 수 없는 링크입니다.'});const b=req.body;for(const k of ['satisfaction','revisit','progress','place','value'])if(Number(b[k])<1||Number(b[k])>5)return res.status(400).json({error:'평가 점수는 1~5점이어야 합니다.'});try{db.prepare('INSERT INTO reviews(application_id,satisfaction,revisit,progress,place,value,text,report,report_text,publish_ok) VALUES(?,?,?,?,?,?,?,?,?,?)').run(a.id,Number(b.satisfaction),Number(b.revisit),Number(b.progress),Number(b.place),Number(b.value),String(b.text||'').slice(0,1000),b.report?1:0,String(b.report_text||'').slice(0,1000),b.publish_ok?1:0);db.prepare("UPDATE applications SET status='평가완료',review_token=NULL WHERE id=?").run(a.id);audit(null,'review_submitted','application',a.id,{publish_ok:!!b.publish_ok});res.json({ok:true});}catch(e){return res.status(409).json({error:'이미 평가가 제출되었습니다.'});}});
app.get('/review/:token',(req,res)=>res.sendFile(path.join(__dirname,'public','review.html')));

cron.schedule('* * * * *',()=>{
  const due=db.prepare("SELECT id FROM applications WHERE status='입금대기' AND payment_deadline IS NOT NULL AND datetime(payment_deadline)<=datetime('now','localtime')").all();
  if(!due.length)return;const tx=db.transaction(()=>{for(const a of due){db.prepare("UPDATE applications SET status='자동취소',payment_deadline=NULL WHERE id=? AND status='입금대기'").run(a.id);notify(a.id,'auto_cancelled');}});tx();
});

// 매일 04:00 개인정보 보유 기간이 지난 신청을 파기하고 만료된 참여 링크를 지운다 (규칙: lib/retention.js)
cron.schedule('0 4 * * *',()=>{const r=runRetention(db);if(r.purged||r.links)audit(null,'retention','application','',r);});

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'서버 오류가 발생했습니다.'});});
app.listen(PORT,()=>{console.log(`오늘의 취향 서버 실행: http://localhost:${PORT}`);console.log(`DB: ${DB_PATH}`);if(JWT_SECRET==='dev-only-change-me-please')console.warn('경고: 운영 전 JWT_SECRET을 반드시 변경하세요.');});
