'use strict';
// 개인정보 보유 기간과 링크 만료 규칙. 개인정보처리방침(public/assets/js/policy.js) "보유 기간"과 같은 내용이어야 한다.
// - 입금 기록이 없는 신청(거절·참여포기·자동취소 등): 모임일로부터 30일 뒤 파기
// - 입금 기록이 있는 신청: 모임일로부터 5년 뒤 파기 (전자상거래법 시행령 제6조, 계약·대금결제 기록 5년)
// - 참여 링크: 모임일로부터 7일 뒤 만료 (출석 처리·참여포기·거절 시에는 즉시 만료)
// 파기는 행을 지우는 대신 식별 정보를 되돌릴 수 없게 지운다(환불·후기·감사 로그와의 연결을 유지하기 위해).

const UNPAID_DAYS = 30;
const PAID_YEARS = 5;
const LINK_DAYS = 7;

// 참여 링크가 아직 유효한지 판단하는 SQL 조건 (schedules 별칭 s)
const LINK_VALID_SQL = `date(s.date,'+${LINK_DAYS} days')>=date('now','localtime')`;

const PURGE_SET = "name='(파기)',phone='purged-'||id,age=0,job='',mbti='',motivation='',preferred_times='[]',ad_source='',marketing_ok=0,participation_token=NULL,review_token=NULL,payment_deadline=NULL,purged_at=datetime('now','localtime')";

// 한 건을 즉시 파기한다 (정보주체의 삭제 요청 처리용)
function purgeApplication(db, id) {
  return db.prepare(`UPDATE applications SET ${PURGE_SET} WHERE id=? AND purged_at IS NULL`).run(id).changes;
}

// 보유 기간이 지난 신청을 파기하고 만료된 참여 링크를 지운다. 매일 cron 으로 실행한다.
function runRetention(db) {
  const sched = 'SELECT s.date FROM schedules s WHERE s.id=applications.schedule_id';
  const tx = db.transaction(() => {
    // 모임이 지나도록 처리되지 않은 접수·승인 건도 입금 기록이 없으므로 30일 기준에 포함된다
    const unpaid = db.prepare(`UPDATE applications SET ${PURGE_SET} WHERE purged_at IS NULL AND paid_at IS NULL AND date((${sched}),'+${UNPAID_DAYS} days')<date('now','localtime')`).run().changes;
    const paid = db.prepare(`UPDATE applications SET ${PURGE_SET} WHERE purged_at IS NULL AND paid_at IS NOT NULL AND date((${sched}),'+${PAID_YEARS} years')<date('now','localtime')`).run().changes;
    const links = db.prepare(`UPDATE applications SET participation_token=NULL WHERE participation_token IS NOT NULL AND date((${sched}),'+${LINK_DAYS} days')<date('now','localtime')`).run().changes;
    return { purged: unpaid + paid, links };
  });
  return tx();
}

module.exports = { UNPAID_DAYS, PAID_YEARS, LINK_DAYS, LINK_VALID_SQL, purgeApplication, runRetention };
