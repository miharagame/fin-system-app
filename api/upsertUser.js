// api/upsertUser.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // POSTリクエスト以外は弾く
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, pass, name, roleId, branch, roleLevel } = req.body;

  if (!id || !pass || !name) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  // フロントエンドと同じSupabase URL（直書きでもOK）
  const supabaseUrl = 'https://deuxqfyxoojgdfwufslr.supabase.co';
  // 先ほどVercelに設定した特権キーを呼び出す
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    return res.status(500).json({ error: 'サーバーの特権キーが設定されていません' });
  }

  // サーバー側の権限でSupabaseクライアントを生成（セッション維持なし）
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const dummyEmail = `${id}@system.local`;

  try {
    // 1. Auth（認証システム）にユーザーが存在するか確認
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find(u => u.email === dummyEmail);

    if (existingUser) {
      // 既存ユーザーの場合はパスワードを更新
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: pass
      });
      if (updateError) throw new Error(`パスワードの更新に失敗: ${updateError.message}`);
    } else {
      // 新規ユーザーの場合は作成（自動でメール確認済みにする）
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: pass,
        email_confirm: true
      });
      if (createError) throw new Error(`アカウントの作成に失敗: ${createError.message}`);
    }

    // 2. Database（名簿テーブル）への登録・更新
    const { error: dbError } = await supabaseAdmin.from('system_users').upsert({
      id: id,
      password: pass,
      name: name,
      role_id: roleId,
      branch: branch,
      role_level: roleLevel,
      updated_at: new Date().toISOString()
    });

    if (dbError) throw new Error(`名簿テーブルの登録に失敗: ${dbError.message}`);

    // 成功レスポンスを返す
    return res.status(200).json({ message: 'アカウントの保存に成功しました' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
