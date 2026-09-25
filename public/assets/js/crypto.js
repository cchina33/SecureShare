/**
 * SecureShare - 暗号化・復号コアモジュール
 * Web Crypto API (AES-256-GCM) を使用したクライアントサイド暗号化
 */

// ArrayBuffer を Base64 文字列に変換するユーティリティ関数
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 文字列を ArrayBuffer に変換するユーティリティ関数
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// URLセーフなBase64文字列への変換（ハッシュに含めるため）
function toUrlSafeBase64(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// URLセーフなBase64文字列を通常のBase64に戻す
function fromUrlSafeBase64(urlSafe) {
  let base64 = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

/**
 * 256bitのAES-GCM暗号鍵を新規生成する
 * @returns {Promise<CryptoKey>} 暗号鍵
 */
async function generateAesKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // エクスポート可能にする
    ['encrypt', 'decrypt']
  );
}

/**
 * 暗号鍵をURLセーフなBase64文字列にエクスポートする
 * @param {CryptoKey} key 
 * @returns {Promise<string>} Base64文字列
 */
async function exportKey(key) {
  const rawKey = await window.crypto.subtle.exportKey('raw', key);
  return toUrlSafeBase64(bufferToBase64(rawKey));
}

/**
 * URLセーフなBase64文字列から暗号鍵をインポートする
 * @param {string} base64Key 
 * @returns {Promise<CryptoKey>} 暗号鍵
 */
async function importKey(base64Key) {
  const rawKey = base64ToBuffer(fromUrlSafeBase64(base64Key));
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
    },
    false,
    ['decrypt']
  );
}

/**
 * 平文テキストを暗号化する
 * @param {string} plainText 暗号化対象の平文
 * @param {CryptoKey} key 暗号鍵
 * @returns {Promise<{ ciphertext: string, iv: string }>} Base64形式の暗号文と初期化ベクトル
 */
async function encryptData(plainText, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);

  // 12バイト（96bit）の初期化ベクトル(IV)を安全に生成
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
  };
}

/**
 * 暗号文を平文に復号する
 * @param {string} cipherTextBase64 Base64形式の暗号文
 * @param {string} ivBase64 Base64形式の初期化ベクトル
 * @param {CryptoKey} key 復号鍵
 * @returns {Promise<string>} 復号された平文テキスト
 */
async function decryptData(cipherTextBase64, ivBase64, key) {
  const cipherBuffer = base64ToBuffer(cipherTextBase64);
  const ivBuffer = base64ToBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    key,
    cipherBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// グローバルスコープに公開（ESモジュール非対応環境でも利用可能にする）
window.SecureCrypto = {
  generateAesKey,
  exportKey,
  importKey,
  encryptData,
  decryptData,
};
