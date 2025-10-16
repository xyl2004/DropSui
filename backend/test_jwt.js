const jwt = require('jsonwebtoken');

const jwtSecret = 'your-super-secret-jwt-key-here-32-chars-long';

// 创建一个测试token
const testToken = jwt.sign(
  { userId: 13, username: 'testuser2' },
  jwtSecret,
  { expiresIn: '24h' }
);

console.log('生成的token:', testToken);

// 验证token
try {
  const decoded = jwt.verify(testToken, jwtSecret);
  console.log('验证成功:', decoded);
} catch (error) {
  console.error('验证失败:', error.message);
}
