import { createApp } from 'vue';
import App from './App.vue';
import './styles/theme.css';
// 清理已移除功能的历史数据（释放本地存储配额）
try { localStorage.removeItem('oh_trash'); } catch (e) {}
try {
  if (!localStorage.getItem('oh_cleanup_v1_done')) {
    Object.keys(localStorage).filter(k => k.startsWith('oh_bgcust_') || k.startsWith('oh_funcs_mod-') || k.startsWith('oh_mod_settings_mod-')).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('oh_user_modules'); localStorage.removeItem('oh_active');
    localStorage.setItem('oh_cleanup_v1_done', '1');
  }
} catch (e) {}
createApp(App).mount('#app');
