// 阿里云百炼 API - Qwen3.5-Plus 视觉模型

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || ''
const ALIYUN_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || ''
const ALIYUN_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || ''
const ALIYUN_SPEECH_APPKEY = process.env.ALIYUN_SPEECH_APPKEY || ''

// 调用 DashScope API 生成应用
export async function generateAppFromText(prompt: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'disable'
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        input: {
          messages: [
            {
              role: 'system',
              content: `你是一个专业的Web应用生成器。请根据用户的需求生成完整的HTML/CSS/JS代码。
              
要求：
1. 生成单个HTML文件，包含所有CSS和JS
2. 代码要完整、可运行、有创意
3. 响应式设计，支持移动端
4. 代码前后用<!DOCTYPE html>和</html>包裹
5. 不要包含markdown代码块标记
6. 直接输出代码，不要任何解释`
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      })
    })

    const data = await response.json()
    
    if (data.output && data.output.choices && data.output.choices[0]) {
      let code = data.output.choices[0].message.content
      
      // 清理代码，移除可能的markdown标记
      code = code.replace(/```html/g, '').replace(/```/g, '').trim()
      
      return { success: true, code }
    }
    
    return { success: false, error: '生成失败，请稍后重试' }
  } catch (error) {
    console.error('文字生成错误:', error)
    return { success: false, error: '生成失败，请稍后重试' }
  }
}

// 调用 DashScope API 生成应用（带图片识别）
export async function generateAppFromImage(imageBase64: string, prompt: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'disable'
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        input: {
          messages: [
            {
              role: 'system',
              content: `你是一个专业的Web应用生成器。请根据用户上传的图片和需求描述生成完整的HTML/CSS/JS代码。

要求：
1. 生成单个HTML文件，包含所有CSS和JS
2. 代码要完整、可运行、有创意
3. 响应式设计，支持移动端
4. 代码前后用<!DOCTYPE html>和</html>包裹
5. 不要包含markdown代码块标记
6. 直接输出代码，不要任何解释`
            },
            {
              role: 'user',
              content: [
                {
                  image: `data:image/jpeg;base64,${imageBase64}`
                },
                {
                  text: prompt || '根据这张图片生成一个相关的Web应用'
                }
              ]
            }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      })
    })

    const data = await response.json()
    
    if (data.output && data.output.choices && data.output.choices[0]) {
      let code = data.output.choices[0].message.content
      
      // 清理代码，移除可能的markdown标记
      code = code.replace(/```html/g, '').replace(/```/g, '').trim()
      
      return { success: true, code }
    }
    
    return { success: false, error: '生成失败，请稍后重试' }
  } catch (error) {
    console.error('图片生成错误:', error)
    return { success: false, error: '生成失败，请稍后重试' }
  }
}

// 语音识别 - 阿里云语音服务
export async function recognizeSpeech(audioBase64: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const timestamp = new Date().getTime()
    
    // 生成签名
    const params = `appkey=${ALIYUN_SPEECH_APPKEY}&token=empty&format=wav&samplerate=16000&scene=general&charset=UTF-8`
    const signatureStr = `POST\n*/binary\napplication/json\nx-ce-algorithm:HMAC-SHA1\nx-ce-date:${timestamp}\n/stream/asr/general`
    
    // 这里需要实际的token，生产环境应从服务端获取
    // 简化实现，返回错误提示
    return { 
      success: false, 
      error: '语音识别服务暂时不可用，请直接输入文字描述需求' 
    }
  } catch (error) {
    console.error('语音识别错误:', error)
    return { success: false, error: '语音识别失败，请直接输入文字描述需求' }
  }
}

// 从语音转文字后再生成应用
export async function generateAppFromVoice(audioBase64: string): Promise<{ success: boolean; code?: string; error?: string }> {
  // 先识别语音
  const recognizeResult = await recognizeSpeech(audioBase64)
  
  if (!recognizeResult.success) {
    return { success: false, error: recognizeResult.error }
  }
  
  // 识别成功后用文字生成应用
  return generateAppFromText(`用户语音需求：${recognizeResult.text}`)
}