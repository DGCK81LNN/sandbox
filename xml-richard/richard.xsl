<?xml version="1.0"?>
<xsl:transform version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/richard">
    <html lang="cmn-Hans">
      <head>
        <meta charset="UTF-8" />
        <title>richard</title>
        <meta name='viewport' content="width=device-width,initial-scale=1" />
        <link rel="stylesheet"
              href="https://dgck81lnn.github.io/bootstrap-lnn/dist/bootstrap-lnn.min.css"
              crossorigin="anonymous" />
        <style><![CDATA[
blockquote {
  padding: 0.5rem;
  padding-left: 2rem;
  background-color: var(--bs-light);
}
.volume-content {
  border: inset;
  margin: 0.5rem 0;
  padding: 0.5rem;
}
.instr:not(:empty) { margin-bottom: 1rem; }
.instr-title { font-weight: bold; }
.instr-title::before { content: "["; }
.instr-title::after { content: "]"; }
.instr-title * { font-weight: normal; }
.instr-content {
  box-sizing: border-box;
  border-left: 1px solid;
  margin: 0;
  padding: 0.5rem;
}
.instr-content > :last-child { margin-bottom: 0; }
.instr-content-choose { padding-left: 2rem; }
.instr-content-js { overflow-x: auto; }
]]></style>
      </head>
      <body>
        <main class="m-2">
          <h1>richard 剧情文件</h1>
          <h2>索引</h2>
          <ul>
            <xsl:for-each select="//volume">
            <li>
              <a>
                <xsl:attribute name="href">#<xsl:value-of select="@id" /></xsl:attribute>
                <code><xsl:value-of select="@id" /></code>
              </a>
              <xsl:if test=".//a[@id]">
              <ul>
                <xsl:for-each select=".//a[@id]">
                <li><a>
                  <xsl:attribute name="href">#<xsl:value-of select="@id" /></xsl:attribute>
                  <code><xsl:value-of select="@id" /></code>
                </a></li>
                </xsl:for-each>
              </ul>
              </xsl:if>
            </li>
            </xsl:for-each>
          </ul>
          <hr />
          <xsl:apply-templates select="./volume" />
        </main>
        <script><![CDATA[
Array.prototype.forEach.call(document.querySelectorAll(".instr-content-js"), function (el) {
  try {
    var raw = el.textContent;
    var re = new RegExp('^' + /^( *)\S/m.exec(raw)[1], 'gm');
    el.textContent = raw.replace(re, '').trim();
  } catch (_) { }
});
]]></script>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="volume">
    <section class="volume">
      <xsl:attribute name="id"><xsl:value-of select="@id" /></xsl:attribute>
      <h2><code><xsl:value-of select="@id" /></code></h2>
      <div class="volume-content">
        <xsl:apply-templates select="./title | ./p | ./h | ./i | ./a | ./b | ./js | ./separator | ./pause | ./choose | ./if | ./elif | ./else | ./case | ./call | ./comment" />
      </div>
    </section>
  </xsl:template>

  <xsl:template match="title">
    <h2><xsl:apply-templates select="./s | ./text()" /></h2>
  </xsl:template>

  <xsl:template match="p">
    <p><xsl:apply-templates select="./s | ./text()" /></p>
  </xsl:template>

  <xsl:template match="h">
    <h2><xsl:apply-templates select="./s | ./text()" /></h2>
  </xsl:template>

  <xsl:template match="i">
    <p><i><xsl:apply-templates select="./s | ./text()" /></i></p>
  </xsl:template>

  <xsl:template match="a">
    <div class="instr">
      <xsl:if test="@id">
      <div class="instr-title"
        ><xsl:attribute name="id"><xsl:value-of select="@id" /></xsl:attribute
        >锚点 <code><xsl:value-of select="@id" /></code
      ></div>
      </xsl:if>
      <xsl:if test="@js">
      <div class="instr-title">执行 <code><xsl:value-of select="@js" /></code></div>
      </xsl:if>
    </div>
  </xsl:template>

  <xsl:template match="b">
    <xsl:variable name="elname">
      <xsl:choose>
        <xsl:when test="@is">
          <xsl:value-of select="@is" />
        </xsl:when>
        <xsl:otherwise>div</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <xsl:element name="{$elname}">
      <xsl:if test="@lang"><xsl:attribute name="lang" select="@lang" /></xsl:if>
      <xsl:if test="@class"><xsl:attribute name="class" select="@class" /></xsl:if>
      <xsl:if test="@style"><xsl:attribute name="style" select="@style" /></xsl:if>
      <xsl:apply-templates select="./p | ./h | ./i | ./a | ./b | ./js | ./separator | ./pause | ./choose | ./if | ./elif | ./else | ./case | ./call | ./comment" />
    </xsl:element>
  </xsl:template>

  <xsl:template match="js">
    <div class="instr">
      <div class="instr-title">执行</div>
      <pre class="instr-content instr-content-js"><code><xsl:value-of select="." /></code></pre>
    </div>
  </xsl:template>

  <xsl:template match="separator">
    <hr />
  </xsl:template>

  <xsl:template match="pause">
    <div class="instr">
      <div class="instr-title">等待点击“继续”</div>
      <hr />
    </div>
  </xsl:template>

  <xsl:template match="choose">
    <div class="instr">
      <div class="instr-title">选择</div>
      <ol class="instr-content instr-content-choose" start="0">
        <xsl:for-each select="./choice">
        <li><xsl:apply-templates select="./s | ./text()" /></li>
        </xsl:for-each>
      </ol>
    </div>
  </xsl:template>

  <xsl:template match="if">
    <div class="instr">
      <div class="instr-title">如果 <code><xsl:value-of select="@js" /></code></div>
      <div class="instr-content">
        <xsl:apply-templates select="./p | ./h | ./i | ./a | ./b | ./js | ./separator | ./pause | ./choose | ./if | ./elif | ./else | ./case | ./call | ./comment" />
      </div>
    </div>
  </xsl:template>

  <xsl:template match="elif">
    <div class="instr">
      <div class="instr-title">否则如果 <code><xsl:value-of select="@js" /></code></div>
      <div class="instr-content">
        <xsl:apply-templates select="./p | ./h | ./i | ./a | ./b | ./js | ./separator | ./pause | ./choose | ./if | ./elif | ./else | ./case | ./call | ./comment" />
      </div>
    </div>
  </xsl:template>

  <xsl:template match="else">
    <div class="instr">
      <div class="instr-title">否则</div>
      <div class="instr-content">
        <xsl:apply-templates select="./p | ./h | ./i | ./a | ./b | ./js | ./separator | ./pause | ./choose | ./if | ./elif | ./else | ./case | ./call | ./comment" />
      </div>
    </div>
  </xsl:template>

  <xsl:template match="case">
    <div class="instr">
      <xsl:choose>
      <xsl:when test="count(./when) = 0">
      <div class="instr-title">报错</div>
      </xsl:when>
      <xsl:when test="count(./when) = 1">
      <div class="instr-title">断言 <code><xsl:value-of select="./when/@js" /></code></div>
      <xsl:if test="./when/*">
      <div class="instr-content">
        <xsl:apply-templates select="./when/p | ./when/h | ./when/i | ./when/a | ./when/b | ./when/js | ./when/separator | ./when/pause | ./when/choose | ./when/if | ./when/elif | ./when/else | ./when/case | ./when/call | ./when/comment" />
      </div>
      </xsl:if>
      </xsl:when>
      <xsl:otherwise>
      <div class="instr-title">分情况</div>
      <xsl:for-each select="./when">
        <div class="instr-title">当 <code><xsl:value-of select="@js" /></code> 时</div>
        <div class="instr-content">
          <xsl:apply-templates select="./p | ./h | ./i | ./a | ./b | ./js | ./separator | ./pause | ./choose | ./if | ./elif | ./else | ./case | ./call | ./comment" />
        </div>
      </xsl:for-each>
      </xsl:otherwise>
      </xsl:choose>
    </div>
  </xsl:template>

  <xsl:template match="call">
    <div class="instr">
      <div class="instr-title">隐藏内容 <code><xsl:value-of select="@target" /></code></div>
    </div>
  </xsl:template>

  <xsl:template match="comment">
    <div class="instr">
      <div class="instr-title">注释 <span><xsl:apply-templates select="./* | ./child::text()" /></span></div>
    </div>
  </xsl:template>

  <xsl:template match="s">
    <xsl:variable name="elname">
      <xsl:choose>
        <xsl:when test="@is">
          <xsl:value-of select="@is" />
        </xsl:when>
        <xsl:otherwise>span</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <xsl:element name="{$elname}">
      <xsl:if test="@lang"><xsl:attribute name="lang" select="@lang" /></xsl:if>
      <xsl:if test="@class"><xsl:attribute name="class" select="@class" /></xsl:if>
      <xsl:if test="@style"><xsl:attribute name="style" select="@style" /></xsl:if>
      <xsl:apply-templates select="./* | ./child::text()" />
    </xsl:element>
  </xsl:template>

  <xsl:template match="text()">
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="*" />
</xsl:transform>