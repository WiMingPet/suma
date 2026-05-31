// pages/privacy.tsx
import Head from 'next/head';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>隐私政策 - 速码方舟AI软件</title>
        <meta name="description" content="速码方舟AI软件隐私政策" />
      </Head>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-8">隐私政策</h1>
          <p className="text-center text-gray-500 mb-8">更新日期：2026年5月25日</p>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. 信息收集</h2>
              <p>速码方舟AI软件 App（以下简称“本App”）由广州速码智能信息有限公司（以下简称“我们”）运营。为了向您提供AI代码生成服务，我们可能会收集以下信息：</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>手机号</strong>：用于用户注册、登录及账户识别。</li>
                <li><strong>提示词/问题描述</strong>：您在使用文字生成、图片识别、语音对话功能时输入的文本内容。</li>
                <li><strong>上传的图片</strong>：您在使用图片识别功能时上传的图片。</li>
                <li><strong>语音录音</strong>：您在使用语音对话功能时的录音（识别为文字后删除原始音频）。</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. 信息使用</h2>
              <p>我们收集的信息将用于：</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>提供、维护和改进本App的功能</li>
                <li>向您提供AI代码生成服务</li>
                <li>处理您的问题和反馈</li>
                <li>发送重要的服务通知</li>
              </ul>
            </section>

            <section className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h2 className="text-xl font-semibold mb-3 text-blue-800">3. AI服务数据处理声明</h2>
              <p className="mb-2"><strong>3.1 数据发送范围</strong><br />
              当您使用以下功能时，您的输入内容会被发送给第三方AI服务商（阿里云百炼大模型）：</p>
              <ul className="list-disc pl-6 mb-3">
                <li>文字生成应用：您输入的描述文本</li>
                <li>图片识别生成：您上传的图片及补充描述</li>
                <li>语音对话生成：您录音后识别出的文字内容</li>
              </ul>
              <p className="mb-2"><strong>3.2 数据使用目的</strong><br />
              AI服务商处理您数据的唯一目的是：根据您的输入内容，生成相应的HTML/CSS/JS代码并返回给您。</p>
              <p className="mb-2"><strong>3.3 数据保护承诺</strong><br />
              我们及我们的AI服务商郑重承诺：</p>
              <ul className="list-disc pl-6 mb-3">
                <li>✅ <strong>不会</strong> 使用您的任何数据用于训练其人工智能模型</li>
                <li>✅ <strong>不会</strong> 将您的数据用于任何其他商业目的</li>
                <li>✅ <strong>不会</strong> 将您的数据出售或共享给任何第三方</li>
                <li>✅ 所有数据传输均采用行业标准的加密协议（TLS/SSL）</li>
              </ul>
              <p className="mb-2"><strong>3.4 用户同意机制</strong><br />
              在您首次使用AI生成功能前，App会通过弹窗明确告知您上述数据处理方式，并需获得您的主动同意后，才会开始处理您的请求。</p>
              <p className="mb-2"><strong>3.5 AI生成内容标识</strong><br />
              由AI生成的内容会在App界面中明确标注“🤖 AI生成”标识，以便您区分人工创作与AI生成内容。</p>
              <p className="mb-2"><strong>3.6 内容举报机制</strong><br />
              如您发现AI生成的内容存在违法违规或其他不当情形，您可以通过App内的“举报”按钮向我们反馈，我们将在收到举报后及时处理。</p>
              <p><strong>3.7 第三方服务商信息</strong><br />
              服务商名称：阿里云计算有限公司<br />
              服务名称：阿里云百炼大模型服务<br />
              隐私政策：<a href="https://www.aliyun.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">https://www.aliyun.com/privacy</a></p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. 数据存储与安全</h2>
              <p>我们采用行业标准的安全措施保护您的个人信息，防止未经授权的访问、披露、修改或销毁。您的输入内容在完成代码生成后，不会被AI服务商持久化存储。我们仅保留必要的交互日志用于问题排查，最长保留期限为30天。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. 用户权利</h2>
              <p>您有权查询、更正、删除您的个人信息，撤回对AI功能处理的同意，注销您的账号以及投诉举报。如需行使上述权利，请通过 privacy@sumaai.cn 联系我们。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. 儿童隐私</h2>
              <p>本App不面向14周岁以下儿童提供服务。如发现我们无意收集了儿童个人信息，请与我们联系，我们将立即删除。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. 政策更新</h2>
              <p>我们可能会不时更新本隐私政策。重大变更时，我们会在App内通过弹窗或公告方式通知您。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. 联系我们</h2>
              <p>广州速码智能信息有限公司<br />
              邮箱：privacy@sumaai.cn<br />
              电话：15920978058<br />
              地址：广州市白云区永平街永泰磨刀南街80号1002之C3510房</p>
            </section>

            <div className="text-center text-gray-400 text-sm pt-6 border-t">
              <p>© 2026 广州速码智能信息有限公司 保留所有权利</p>
              <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">粤ICP备2026044431号</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}