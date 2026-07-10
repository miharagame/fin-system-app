// api/upsertUser.js
import { createClient } from '@supabase/supabase-js';
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { id, pass, name, roleId, branch, roleLevel } = req.body;
  if (!id || !pass || !name) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  const supabaseUrl = 'https://deuxqfyxoojgdfwufslr.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    return res.status(500).json({ error: 'サーバーの特権キーが設定されていません' });
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const dummyEmail = `${id}@system.local`;
  try {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    const existingUser = users.find(u => u.email === dummyEmail);
    if (existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: pass
      });
      if (updateError) throw new Error(`パスワードの更新に失敗: ${updateError.message}`);
    } else {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: pass,
        email_confirm: true
      });
      if (createError) throw new Error(`アカウントの作成に失敗: ${createError.message}`);
    }

    const { error: dbError } = await supabaseAdmin.from('system_users').upsert({
      id: id,
      name: name,
      role_id: roleId,
      branch: branch,
      role_level: roleLevel,
      updated_at: new Date().toISOString()
    });
    if (dbError) throw new Error(`名簿テーブルの登録に失敗: ${dbError.message}`);
    return res.status(200).json({ message: 'アカウントの保存に成功しました' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
