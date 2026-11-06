import { feishuDownload, feishuUpload } from './client.js';

export async function downloadMedia(fileToken) {
  return feishuDownload(`/open-apis/drive/v1/medias/${fileToken}/download`);
}

export async function uploadMedia({ fileName, parentType, parentNode, buffer, mimeType }) {
  const form = new FormData();
  form.set('file_name', fileName);
  form.set('parent_type', parentType);
  form.set('parent_node', parentNode);
  form.set('size', String(buffer.length));
  form.set('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), fileName);
  return feishuUpload('/open-apis/drive/v1/medias/upload_all', form);
}
