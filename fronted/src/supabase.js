import { createClient } from '@supabase/supabase-js'

// 从环境变量获取Supabase配置
// 优先使用VITE_前缀的环境变量，如果没有则使用根目录的.env文件中的值
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_API_KEY

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.warn('请设置VITE_SUPABASE_URL环境变量或在根目录创建.env文件')
}

if (!supabaseKey || supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn('请设置VITE_SUPABASE_ANON_KEY环境变量或在根目录创建.env文件')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
