import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

interface Message {
  sender: 'user' | 'agent'
  text: string
  timestamp: string
}

const filename = (ext: string) =>
  `agent-response-${new Date().toISOString().split('T')[0]}.${ext}`

function download(content: string, mimeType: string, ext: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename(ext)
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsMarkdown(message: Message) {
  const header = `**Agent** — ${new Date(message.timestamp).toLocaleString()}\n\n`
  download(header + message.text, 'text/markdown', 'md')
}

export function exportAsHTML(message: Message) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Response</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  .header { color: #666; font-size: 0.85em; margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #1565c0; padding-left: 12px; margin: 12px 0; color: #555; }
  h1, h2, h3 { margin-top: 16px; }
</style>
</head>
<body>
<div class="header">Agent Response — ${new Date(message.timestamp).toLocaleString()}</div>
<div class="content">${markdownToBasicHTML(message.text)}</div>
</body>
</html>`
  download(html, 'text/html', 'html')
}

function markdownToBasicHTML(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // code blocks (before other transforms)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code}</code></pre>`)
    // headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // horizontal rule
    .replace(/^---$/gm, '<hr>')
    // simple table support
    .replace(/^\|(.+)\|$/gm, (_m, row: string) => {
      const cells = row.split('|').map((c: string) => c.trim())
      return '<tr>' + cells.map((c: string) => `<td>${c}</td>`).join('') + '</tr>'
    })
    // paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // single newlines to br
    .replace(/\n/g, '<br>')
    // wrap in paragraph
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
}

export async function exportAsPDF(messageElement: HTMLElement) {
  const canvas = await html2canvas(messageElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save(filename('pdf'))
}

export async function exportAsDOCX(message: Message) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: 'Agent Response', bold: true, size: 28 }),
        new TextRun({ text: ` — ${new Date(message.timestamp).toLocaleString()}`, color: '888888', size: 20 }),
      ],
      spacing: { after: 200 },
    }),
  ]

  const lines = message.text.split('\n')
  for (const line of lines) {
    if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        children: parseInlineMarkdown(line.slice(2)),
        bullet: { level: 0 },
      }))
    } else if (/^\d+\.\s/.test(line)) {
      paragraphs.push(new Paragraph({
        children: parseInlineMarkdown(line.replace(/^\d+\.\s/, '')),
        numbering: { reference: 'default-numbering', level: 0 },
      }))
    } else if (line.trim() === '') {
      paragraphs.push(new Paragraph({ text: '' }))
    } else if (line.startsWith('```')) {
      // skip code fences
    } else if (line.startsWith('|')) {
      // render table rows as plain text
      const cells = line.split('|').filter(c => c.trim() && !c.match(/^[\s-:]+$/))
      if (cells.length > 0) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: cells.map(c => c.trim()).join('  |  '), font: 'Courier New', size: 20 })],
        }))
      }
    } else {
      paragraphs.push(new Paragraph({ children: parseInlineMarkdown(line) }))
    }
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal' as const, text: '%1.', alignment: 'start' as const }],
      }],
    },
    sections: [{ children: paragraphs }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename('docx'))
}

function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = []
  const regex = /\*\*(.+?)\*\*|`(.+?)`|([^*`]+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], bold: true }))
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], font: 'Courier New', size: 20 }))
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3] }))
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text })]
}
