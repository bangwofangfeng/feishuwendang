import { db } from '../server/db.js';

const rows = db.prepare("SELECT id, title FROM sources WHERE token GLOB 'demo_*'").all();
for (const row of rows) {
  db.prepare('DELETE FROM sources WHERE id = ?').run(row.id);
}
console.log(rows.length ? `已清除 ${rows.length} 条演示数据。` : '没有演示数据需要清除。');
