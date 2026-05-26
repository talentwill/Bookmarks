document.addEventListener('DOMContentLoaded', async () => {
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

  document.getElementById('btn-save').addEventListener('click', async () => {
    await chrome.storage.local.set({
      deepseekApiKey: document.getElementById('deepseek-key').value,
      deepseekBaseUrl: document.getElementById('deepseek-url').value || 'https://api.deepseek.com',
      deepseekModel: document.getElementById('deepseek-model').value || 'deepseek-chat',
      supabaseUrl: document.getElementById('supabase-url').value,
      supabaseKey: document.getElementById('supabase-key').value,
      deadLinkCheckFrequency: document.getElementById('dead-link-frequency').value,
    });

    document.getElementById('save-status').textContent = '✓ 已保存';
    setTimeout(() => {
      document.getElementById('save-status').textContent = '';
    }, 2000);
  });
});
