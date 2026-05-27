document.addEventListener('DOMContentLoaded', async () => {
  // 返回按钮
  document.getElementById('btn-back').addEventListener('click', () => {
    window.close();
  });

  try {
    const config = await chrome.storage.local.get([
      'deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel',
      'supabaseUrl', 'supabaseKey',
      'deadLinkCheckFrequency',
    ]);

    if (config.deepseekApiKey) document.getElementById('deepseek-key').value = config.deepseekApiKey;
    if (config.deepseekBaseUrl) document.getElementById('deepseek-url').value = config.deepseekBaseUrl;
    if (config.deepseekModel) document.getElementById('deepseek-model').value = config.deepseekModel;
    if (config.supabaseUrl) document.getElementById('supabase-url').value = config.supabaseUrl;
    if (config.supabaseKey) document.getElementById('supabase-key').value = config.supabaseKey;
    if (config.deadLinkCheckFrequency) document.getElementById('dead-link-frequency').value = config.deadLinkCheckFrequency;
  } catch (e) {
    document.getElementById('save-status').textContent = '加载配置失败';
  }

  document.getElementById('btn-save').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save');
    const status = document.getElementById('save-status');
    btn.disabled = true;

    try {
      await chrome.storage.local.set({
        deepseekApiKey: document.getElementById('deepseek-key').value,
        deepseekBaseUrl: document.getElementById('deepseek-url').value || 'https://api.deepseek.com',
        deepseekModel: document.getElementById('deepseek-model').value || 'deepseek-chat',
        supabaseUrl: document.getElementById('supabase-url').value,
        supabaseKey: document.getElementById('supabase-key').value,
        deadLinkCheckFrequency: document.getElementById('dead-link-frequency').value,
      });

      status.textContent = '✓ 已保存';
      status.style.color = '#2e7d32';
    } catch (e) {
      status.textContent = '保存失败: ' + e.message;
      status.style.color = '#c62828';
    } finally {
      btn.disabled = false;
      setTimeout(() => { status.textContent = ''; }, 3000);
    }
  });
});
