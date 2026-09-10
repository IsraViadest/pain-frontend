#!/usr/bin/env python3
"""Build the artist-team reference pair using ReportLab, Pillow, and pypdf.

Run: python3 docs/explanation-guides/build_guides.py
On the author's Mac the bundled interpreter is:
/Users/cs/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
The guide uses installed Arial/Georgia fonts; pass --font-dir on another machine.
Use --audience age-5 professor to build those pairs without rewriting the adult edition.
Only the selected audience PDFs are written. QA renders belong in /tmp.
"""

import argparse
import html
import math
import re
from pathlib import Path

from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parent
PAGE_W, PAGE_H = A4
MARGIN = 46
WIDTH = PAGE_W - 2 * MARGIN
NAVY = colors.HexColor('#171b45')
TEAL = colors.HexColor('#17666b')
CORAL = colors.HexColor('#b0443a')
INK = colors.HexColor('#27323b')
MUTED = colors.HexColor('#566570')
PALE = colors.HexColor('#eef4f3')
EDITIONS = {
    'age-18': ('ADULT EDITION', 'Understanding the project',
               'Shared background, source facts, meanings, and possibilities', '1.3'),
    'age-5': ('EXPLAIN IT LIKE I AM FIVE', 'People, places, and care',
              'Simple ideas, little stories, and background for the artists', '1.0'),
    'age-8': ('AGE 8 EDITION', 'Reading the pain globe',
              'The stories, science, and data behind the artwork', '1.0'),
    'professor': ('ADVANCED / PROFESSOR EDITION', 'Interpreting the evidence',
                  'Measures, sources, models, and the meaning of the artwork', '1.0'),
}


def register_fonts(directory):
    files = {'Body': 'Arial.ttf', 'Body-Bold': 'Arial Bold.ttf',
             'Body-Italic': 'Arial Italic.ttf', 'Body-BoldItalic': 'Arial Bold Italic.ttf',
             'Display': 'Georgia.ttf'}
    for name, filename in files.items():
        pdfmetrics.registerFont(TTFont(name, str(directory / filename)))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='Body-Bold',
                                 italic='Body-Italic', boldItalic='Body-BoldItalic')


def styles(audience='age-18'):
    s = getSampleStyleSheet()
    s.add(ParagraphStyle('Text', fontName='Body', fontSize=10.2, leading=14.4,
                         textColor=INK, spaceAfter=8, splitLongWords=True,
                         allowWidows=0))
    s.add(ParagraphStyle('TitleMain', fontName='Display', fontSize=28, leading=34,
                         textColor=NAVY, spaceAfter=18))
    s.add(ParagraphStyle('Major', parent=s['Text'], fontName='Display', fontSize=23,
                         leading=29, spaceAfter=16, keepWithNext=True, textColor=NAVY))
    s.add(ParagraphStyle('Minor', parent=s['Text'], fontName='Body-Bold', fontSize=12,
                         leading=16, spaceBefore=14, spaceAfter=7, keepWithNext=True,
                         textColor=TEAL))
    s.add(ParagraphStyle('Note', parent=s['Text'], fontName='Body-Italic', fontSize=9,
                         leading=12.5, textColor=MUTED, backColor=PALE,
                         borderPadding=7, spaceBefore=5, spaceAfter=13))
    s.add(ParagraphStyle('Cell', parent=s['Text'], fontSize=8.8, leading=11.8,
                         spaceAfter=0))
    s.add(ParagraphStyle('CellHead', parent=s['Cell'], fontName='Body-Bold',
                         textColor=colors.white))
    s.add(ParagraphStyle('BulletText', parent=s['Text'], leftIndent=10,
                         firstLineIndent=-8, spaceAfter=5))
    s.add(ParagraphStyle('Small', parent=s['Text'], fontSize=8.8, leading=12,
                         textColor=MUTED))
    s.add(ParagraphStyle('Reference', parent=s['Text'], fontSize=9.4, leading=12.5,
                         spaceAfter=6))
    s.add(ParagraphStyle('Sheet', parent=s['Text'], fontSize=9, leading=12,
                         spaceAfter=5))
    s.add(ParagraphStyle('SheetHead', parent=s['Minor'], fontSize=10.6, leading=13,
                         spaceBefore=8, spaceAfter=5))
    if audience in ('age-5', 'age-8'):
        for name in ('Text', 'BulletText'):
            s[name].fontSize, s[name].leading = (12.4, 18) if audience == 'age-5' else (12, 17)
        s['Minor'].fontSize, s['Minor'].leading = 14, 19
        s['Note'].fontSize, s['Note'].leading = 10.2, 14
        s['Cell'].fontSize, s['Cell'].leading = 9.6, 13
        s['CellHead'].fontSize, s['CellHead'].leading = 9.6, 13
    return s


def markup(text, reference_links=True):
    """Format the small Markdown subset used in these authored documents."""
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',
                  r'<a href="\2" color="#17666b"><u>\1</u></a>', text)
    text = re.sub(r'`([^`]+)`', r'<font face="Courier" size="8.2">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    if reference_links:
        text = re.sub(r'\[([LSC]\d+)(?:-([LSC]\d+))?\]',
                      lambda m: '<a href="#ref-%s" color="#17666b">%s</a>' %
                      (m[1], m[0]), text)
    return text


class GuideDoc(BaseDocTemplate):
    def __init__(self, filename, audience='age-18', **kwargs):
        self.audience = audience
        super().__init__(str(filename), pagesize=A4, leftMargin=MARGIN,
                         rightMargin=MARGIN, topMargin=55, bottomMargin=48,
                         title=f'P.A.I.N. - {EDITIONS[audience][1]}',
                         author='P.A.I.N. project documentation', **kwargs)
        self.addPageTemplates(PageTemplate(id='guide', frames=[Frame(
            MARGIN, 48, WIDTH, PAGE_H - 103, leftPadding=0, rightPadding=0,
            topPadding=0, bottomPadding=0)], onPage=self.page_chrome))

    def page_chrome(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#d6e0df'))
        canvas.line(MARGIN, PAGE_H - 36, PAGE_W - MARGIN, PAGE_H - 36)
        canvas.setFillColor(MUTED)
        canvas.setFont('Body', 8)
        canvas.drawString(MARGIN, PAGE_H - 27,
                          'P.A.I.N.  /  ARTIST TEAM  /  ' + EDITIONS[self.audience][0])
        canvas.drawString(MARGIN, 28,
                          'Exhibition and research checked 9 September 2026  |  v' +
                          EDITIONS[self.audience][3])
        canvas.drawRightString(PAGE_W - MARGIN, 28, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if not hasattr(flowable, 'bookmark'):
            return
        level, label, key = flowable.bookmark
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(label, key, level=level, closed=level == 0)
        if level == 0:
            self.notify('TOCEntry', (0, label, self.page, key))


class ExhibitImage(Flowable):
    def __init__(self, path, width=WIDTH, annotate=True):
        super().__init__()
        self.path, self.width, self.annotate = path, width, annotate
        with PILImage.open(path) as im:
            self.pixel_width, self.pixel_height = im.size
        self.height = width * self.pixel_height / self.pixel_width

    def draw(self):
        c = self.canv
        c.drawImage(str(self.path), 0, 0, width=self.width, height=self.height)
        if not self.annotate:
            return
        if 'network' in self.path.name:
            positions = [(90, 455), (432, 287), (730, 670)]
        else:
            positions = [(877, 204), (585, 489), (990, 518), (965, 330), (1112, 335)]
        for n, (px, py) in enumerate(positions, 1):
            x, y = px / self.pixel_width * self.width, (1 - py / self.pixel_height) * self.height
            c.setFillColor(TEAL)
            c.setStrokeColor(colors.white)
            c.setLineWidth(1)
            c.circle(x, y, 9, stroke=1, fill=1)
            c.setFillColor(colors.white)
            c.setFont('Body-Bold', 9)
            c.drawCentredString(x, y - 3, str(n))


class Diagram(Flowable):
    def __init__(self, kind):
        super().__init__()
        self.kind, self.width = kind, WIDTH
        self.height = {'pipeline': 126, 'graph': 230, 'scale': 165,
                       'layers': 242, 'aggregation': 192, 'warming': 190}[kind]

    def label(self, x, y, text, size=9, color=INK, centered=True):
        c = self.canv
        c.setFillColor(color)
        c.setFont('Body', size)
        for i, line in enumerate(text.split('\n')):
            (c.drawCentredString if centered else c.drawString)(x, y - i * 12, line)

    def arrow(self, x1, y1, x2, y2):
        c = self.canv
        c.setStrokeColor(TEAL)
        c.setLineWidth(1.4)
        c.line(x1, y1, x2, y2)
        c.line(x2, y2, x2 - 5, y2 + 3)
        c.line(x2, y2, x2 - 5, y2 - 3)

    def draw(self):
        c = self.canv
        if self.kind == 'warming':
            self.label(WIDTH / 2, 174, 'Which place is warmer? Which warmed more?', 12, TEAL)
            for row, (name, before, after) in enumerate([('Place A', 10, 14),
                                                        ('Place B', 25, 26)]):
                y = 113 - row * 62
                self.label(8, y + 7, name, 10.5, centered=False)
                for j, (value, color) in enumerate([(before, TEAL), (after, CORAL)]):
                    c.setFillColor(color)
                    c.rect(80, y + 15 - j * 20, value * 10, 13, fill=1, stroke=0)
                    self.label(86 + value * 10, y + 18 - j * 20,
                               f'{value}°C', 9, centered=False)
                self.label(WIDTH - 39, y + 4, f'+{after - before}°C', 14, CORAL)
            self.label(WIDTH / 2, 24,
                       'Teal: earlier climate average. Coral: later climate average.', 9)
            self.label(WIDTH / 2, 7,
                       'Made-up numbers for learning; these are not exhibition measurements.', 8.7)
        elif self.kind == 'layers':
            cards = [('BODY', 'When moving hurts', 'The marked surface', CORAL),
                     ('FEELINGS', 'Words about hurt and worry', 'Words and lines', TEAL),
                     ('OUR WORLD', 'Places changing around us', 'The atmosphere', TEAL),
                     ('EVERYDAY LIFE', 'Resources and possibilities', 'The yellow layer',
                      colors.HexColor('#997411'))]
            w = (WIDTH - 18) / 2
            for i, (title, meaning, cue, color) in enumerate(cards):
                x, y = (i % 2) * (w + 18), 126 - (i // 2) * 117
                c.setFillColor(PALE)
                c.setStrokeColor(color)
                c.roundRect(x, y, w, 104, 10, fill=1, stroke=1)
                self.label(x + w / 2, y + 76, title, 11, color)
                self.label(x + w / 2, y + 49, meaning, 10.5)
                self.label(x + w / 2, y + 24, cue, 9, MUTED)
        elif self.kind == 'aggregation':
            self.label(WIDTH / 2, 176, 'The same texts can support different summaries', 12, TEAL)
            for i, (title, formula, detail) in enumerate([
                ('EXHIBITION', '0.75 x news mean + 0.25 x expression mean',
                 'Fixed source-family weights when both exist'),
                ('LATEST COMPLETED ANALYSIS', '(news score sum + expression score sum) / all records',
                 'Each record has equal weight within its country')]):
                y = 87 - i * 83
                c.setFillColor(PALE)
                c.setStrokeColor(TEAL)
                c.roundRect(8, y, WIDTH - 16, 73, 5, fill=1, stroke=1)
                self.label(WIDTH / 2, y + 53, title, 9, TEAL)
                self.label(WIDTH / 2, y + 32, formula, 10)
                self.label(WIDTH / 2, y + 13, detail, 8.8, MUTED)
        elif self.kind == 'pipeline':
            labels = ['6 source\ncollections', 'PCAI\ncountry coding', 'Classifier\ngroup scores', 'Country means\n75/25 blend', 'Winning word\nand category']
            w = (WIDTH - 4 * 13) / 5
            for i, txt in enumerate(labels):
                x = i * (w + 13)
                c.setFillColor(PALE)
                c.setStrokeColor(TEAL)
                c.roundRect(x, 43, w, 55, 5, fill=1, stroke=1)
                self.label(x + w / 2, 76, txt, 8.4)
                if i < 4:
                    self.arrow(x + w + 2, 70, x + w + 11, 70)
            self.label(WIDTH / 2, 21, 'Training examples are separate from the real texts analysed here.', 8.7)
            self.label(WIDTH / 2, 7,
                       'Earlier exhibition pipeline; the latest analysis uses equal record weights.', 8.5)
        elif self.kind == 'graph':
            for i, inside in enumerate([False, True]):
                x0 = i * (WIDTH / 2 + 2)
                cx, cy, radius = x0 + 124, 110, 52
                c.setFillColor(PALE)
                c.setStrokeColor(colors.HexColor('#b6ceca'))
                c.circle(cx, cy, radius, stroke=1, fill=1)
                c.setStrokeColor(CORAL if inside else TEAL)
                c.setLineWidth(2)
                c.setDash(4, 2) if inside else c.setDash()
                c.line(cx - radius, cy, cx + radius, cy)
                c.setDash()
                for name, x, y in [('A', cx-radius, cy), ('B', cx+radius, cy),
                                   ('C', cx+10, cy+25 if inside else cy+72),
                                   ('D', cx-80, cy+59)]:
                    c.setFillColor(NAVY)
                    c.circle(x, y, 3, fill=1, stroke=0)
                    self.label(x, y+8, name, 8)
                self.label(cx, 31, 'REJECT: C is inside' if inside else 'KEEP: no point inside', 9,
                           CORAL if inside else TEAL)
            self.label(WIDTH / 2, 214, 'The idea behind a Gabriel connection', 12, TEAL)
            self.label(WIDTH / 2, 9, 'A flat illustration of proximity; the globe uses the same idea in three dimensions.', 8.2)
        else:
            x0, x1, y = 40, WIDTH - 40, 90
            for i in range(100):
                c.setFillColor(colors.Color(0.95, 0.87, 0.25, alpha=0.15 + i / 120))
                c.rect(x0+(x1-x0)*i/100, y-5, (x1-x0)/100+0.5, 10, fill=1, stroke=0)
            for j,(name,value) in enumerate([('Monaco',288001.574856495),('Luxembourg',137781.68),('India',2591.9916607122),('Burundi',216.231928531758)]):
                signal=1-(math.log(value)-math.log(216.231928531758))/(math.log(288001.574856495)-math.log(216.231928531758))
                x=x0+signal*(x1-x0)
                c.setStrokeColor(NAVY)
                c.line(x,y-9,x,y+9)
                above=j!=1
                self.label(x,126 if above else 59,name,8.8)
                self.label(x,113 if above else 46,f'${value:,.0f}',8)
            self.label(WIDTH/2,17,'GDP per person decreases as the artistic yellow signal increases.',8.7)
            self.label(x0,73,'0',8)
            self.label(x1,73,'1',8)


def make_table(lines, s, width=WIDTH):
    rows = [[cell.strip() for cell in line.strip().strip('|').split('|')] for line in lines]
    rows = [r for r in rows if not all(re.fullmatch(r'[:\- ]+', cell) for cell in r)]
    n = len(rows[0])
    ratios = {2:[.28,.72], 3:[.24,.53,.23], 4:[.27,.19,.23,.31],
              5:[.31,.16,.13,.15,.25]}[n]
    if rows[0][0] == 'Languages 1-25':
        ratios = [.25] * 4
    if n == 3 and 'What it does not measure' in rows[0]:
        ratios = [.18,.41,.41]
    if n == 3:
        ratios = {
            'Number of examples': [.28,.20,.52],
            'Records analysed': [.46,.25,.29],
            'Broad-category macro-F1': [.34,.33,.33],
            'Records associated with the country': [.22,.28,.50],
            'Text records': [.29,.20,.51],
            'What it represents': [.25,.43,.32],
            'Articles or records': [.33,.23,.44],
            'Purpose': [.27,.43,.30],
            'Selected exhibition material': [.26,.29,.45],
            'Records': [.35,.23,.42],
            'Size': [.32,.23,.45],
            'Examples': [.32,.21,.47],
        }.get(rows[0][1], ratios)
    data = [[Paragraph(markup(cell), s['CellHead' if i==0 else 'Cell'])
             for cell in row] for i,row in enumerate(rows)]
    table = Table(data, colWidths=[width*x for x in ratios], repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),NAVY), ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white, PALE]),
        ('LEFTPADDING',(0,0),(-1,-1),7), ('RIGHTPADDING',(0,0),(-1,-1),7),
        ('TOPPADDING',(0,0),(-1,-1),7), ('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LINEBELOW',(0,0),(-1,0),.6,NAVY),
    ]))
    if rows[0][0] == 'Languages 1-25':
        table.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),4),
                                   ('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    return table


def parse_markdown(text, s, sheet=False, image_width=WIDTH-15):
    lines=text.splitlines()
    out=[]
    i=0
    bookmark=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:
            i+=1
            continue
        if line.startswith('# '):
            if not sheet:
                out.append(PageBreak())
                title=line[2:]
                p=Paragraph(markup(title),s['Major'])
                p.bookmark=(0,title,f'section-{bookmark}')
                bookmark+=1
                out.append(p)
            i+=1
        elif line.startswith('## '):
            p=Paragraph(markup(line[3:]),s['SheetHead' if sheet else 'Minor'])
            if not sheet:
                p.bookmark=(1,line[3:],f'section-{bookmark}')
                bookmark+=1
            out.append(p)
            i+=1
        elif line.startswith('|'):
            block=[]
            while i<len(lines) and lines[i].lstrip().startswith('|'):
                block.append(lines[i]);i+=1
            out.extend([make_table(block,s),Spacer(1,10)])
        elif line.startswith('!['):
            path=re.search(r'\]\(([^)]+)\)',line)[1]
            i+=1
            while i<len(lines) and not lines[i].strip():
                i+=1
            caption=[]
            while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','![','>')):
                caption.append(lines[i].strip());i+=1
            figure=ExhibitImage(ROOT/path,width=image_width)
            figure.hAlign='CENTER'
            out.append(KeepTogether([Spacer(1,8),figure,Spacer(1,8),
                Paragraph(markup(' '.join(caption)),s['Small']),Spacer(1,8)]))
        elif line.startswith('[[DIAGRAM:'):
            out.extend([Diagram(re.search(r':(\w+)',line)[1]),Spacer(1,12)])
            i+=1
        else:
            note=line.startswith('>')
            bullet=line.startswith('- ')
            paragraph=[line[1:].strip() if note else line[2:] if bullet else line]
            i+=1
            while i<len(lines) and lines[i].strip() and not re.match(r'^(#|>|- |\||!\[|\[\[DIAGRAM:)',lines[i]):
                paragraph.append(lines[i].strip());i+=1
            raw=' '.join(paragraph)
            formatted=markup(raw,reference_links=not sheet)
            ref=re.match(r'\*\*\[([LSC]\d+)\]',raw)
            if ref:
                formatted=f'<a name="ref-{ref[1]}"/>'+formatted
            style='Sheet' if sheet else 'Note' if note else 'BulletText' if bullet else 'Text'
            if ref and not sheet:
                style='Reference'
            out.append(Paragraph(('&#8226; ' if bullet else '')+formatted,s[style]))
    # Keep each short country story with its evidence and interpretation.
    grouped=[]
    i=0
    while i<len(out):
        item=out[i]
        if getattr(item,'bookmark',(0,'',''))[1].startswith('Story '):
            card=[item];i+=1
            while i<len(out) and not hasattr(out[i],'bookmark') and not isinstance(out[i],PageBreak):
                card.append(out[i]);i+=1
            grouped.append(KeepTogether(card))
        else:
            grouped.append(item);i+=1
    return grouped


class Cover(Flowable):
    def __init__(self, audience='age-18'):
        super().__init__()
        self.audience = audience
        self.width=WIDTH
        self.height=PAGE_H-110

    def draw(self):
        c=self.canv
        edition, title, subtitle, version = EDITIONS[self.audience]
        c.setFillColor(TEAL)
        c.setFont('Body-Bold',10)
        c.drawString(0,self.height-15,'ARTIST TEAM REFERENCE  /  ' + edition)
        c.setFillColor(NAVY)
        c.setFont('Display',49)
        c.drawString(0,self.height-89,'P.A.I.N.')
        c.setFont('Display',29)
        c.drawString(0,self.height-135,title)
        c.setFont('Body',14)
        c.setFillColor(MUTED)
        c.drawString(0,self.height-167,subtitle)
        picture=ExhibitImage(ROOT/'assets/exhibition-overview.png',annotate=False)
        picture.canv=c
        picture.drawOn(c,0,180)
        for x,number,label in [(0,'04','perspectives'),(180,'25','country stories'),(357,'AI','latest research')]:
            c.setFillColor(TEAL)
            c.setFont('Display',27)
            c.drawString(x,132,number)
            c.setFont('Body',10)
            c.setFillColor(MUTED)
            c.drawString(x,112,label)
        c.setFillColor(INK)
        c.setFont('Body',11)
        c.drawString(0,69,'What you see. What it means. Why it matters.')
        c.setFont('Body',9)
        c.setFillColor(MUTED)
        c.drawString(0,29,'English project reference  |  9 September 2026  |  Version ' + version)
        c.drawString(0,13,'With a separate one-page keyword sheet')


def build_guide(s, audience='age-18'):
    text=(ROOT/f'{audience}-project-guide.md').read_text()
    assert len(re.findall(r'^## Story \d\d /',text,re.M))==25
    assert '\u2014' not in text,'No em dashes'
    used_references = set()
    for first, last in re.findall(r'\[([LSC]\d+)(?:-([LSC]\d+))?\]', text):
        used_references.add(first)
        if last:
            used_references.update(first[0] + str(n) for n in
                                   range(int(first[1:]), int(last[1:]) + 1))
    defined_references = set(re.findall(r'^\*\*\[([LSC]\d+)\]', text, re.M))
    assert used_references <= defined_references, used_references - defined_references
    assert not re.search(r'^# [MSA][123] /|\*\*Say:\*\*|Looking pause:', text, re.M)
    toc=TableOfContents()
    toc.levelStyles=[ParagraphStyle('ContentsEntry',fontName='Body',fontSize=10.2,
                                   leading=14,leftIndent=0,firstLineIndent=0,
                                   spaceBefore=6,textColor=INK)]
    heading=Paragraph('Contents / A shared reference',s['Major'])
    heading.bookmark=(0,'Contents','contents')
    content=text.split('\n',1)[1]
    parsed=parse_markdown('# About this guide\n'+content,s,
                          image_width=WIDTH*.8 if audience=='age-8' else WIDTH-15)
    story=[Cover(audience),PageBreak(),heading,
           Paragraph('Facts, meanings, sources, country stories, and optional ways to frame the ideas.',s['Text']),toc]
    story.extend(parsed)
    doc=GuideDoc(ROOT/f'{audience}-project-guide.pdf', audience=audience)
    doc.multiBuild(story)


def build_sheet(s, audience='age-18'):
    text=(ROOT/f'{audience}-keyword-sheet.md').read_text()
    assert '\u2014' not in text
    parts=re.split(r'^## ',text,flags=re.M)
    sections={p.split('\n',1)[0]:p.split('\n',1)[1] for p in parts[1:]}
    left=['The project','The four layers','Current exhibition']
    right=['Latest PCAI research','Country examples','Optional framing']
    columns=[]
    for titles in [left,right]:
        fragment='\n\n'.join('## '+title+'\n'+sections[title] for title in titles)
        columns.append(parse_markdown(fragment,s,sheet=True))
    table=Table([[columns[0],columns[1]]],colWidths=[WIDTH/2,WIDTH/2],hAlign='LEFT')
    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                              ('LEFTPADDING',(0,0),(0,0),0),
                              ('RIGHTPADDING',(0,0),(0,0),12),
                              ('LEFTPADDING',(1,0),(1,0),12),
                              ('RIGHTPADDING',(1,0),(1,0),0),
                              ('LINEBEFORE',(1,0),(1,0),.5,colors.HexColor('#cbdad7'))]))
    doc=BaseDocTemplate(str(ROOT/f'{audience}-keyword-sheet.pdf'),pagesize=A4,
                       title='P.A.I.N. - Artist team quick reference',author='P.A.I.N. project documentation')
    frame=Frame(MARGIN,33,WIDTH,PAGE_H-65,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
    doc.addPageTemplates(PageTemplate(id='sheet',frames=[frame]))
    story=[Paragraph('P.A.I.N. / Quick reference',s['TitleMain']),
           Paragraph('ARTIST TEAM  |  ' + EDITIONS[audience][0] +
                     '  |  ENGLISH  |  9 SEPTEMBER 2026',s['Small']),
           Spacer(1,8),table,
           Spacer(1,5),Paragraph('Shared background for explaining the project in your own words. Examples are possibilities, not required wording.',s['Small'])]
    doc.build(story)


def verify_outputs(audience='age-18'):
    guide=PdfReader(ROOT/f'{audience}-project-guide.pdf')
    sheet=PdfReader(ROOT/f'{audience}-keyword-sheet.pdf')
    assert len(sheet.pages)==1,'Keyword sheet must remain one page'
    assert len(guide.outline)>=10,'Guide needs working navigation'
    text='\n'.join(page.extract_text() or '' for page in guide.pages)
    for document in (guide, sheet):
        visible='\n'.join(page.extract_text() or '' for page in document.pages)
        assert not re.search(r'/Users/|/Volumes/|\b\S+\.(?:json|ts|csv|py|parquet|npz|mjs|pdf)\b',
                             visible), 'Keep implementation filenames out of audience documents'
        assert all(abs(float(p.mediabox.width)-PAGE_W) < 1 and
                   abs(float(p.mediabox.height)-PAGE_H) < 1 for p in document.pages)
        page_ids = {p.indirect_reference.idnum for p in document.pages}
        for page in document.pages:
            for ref in page.get('/Annots', []):
                destination = ref.get_object().get('/Dest')
                if isinstance(destination, list):
                    assert destination[0].idnum in page_ids, 'Broken internal link'
    assert not re.search(r'\b[MSA][123] /|planned pauses|spoken words|Say:',text)
    for n in range(1,26):
        assert f'Story {n:02d}' in text,n
    assert '[[DIAGRAM:' not in text
    uris=[]
    for page in guide.pages:
        for ref in page.get('/Annots',[]):
            obj=ref.get_object()
            if obj.get('/A',{}).get('/URI'):
                uris.append(str(obj['/A']['/URI']))
    assert len(uris)>=20,'Public references should be clickable'
    print(f'{audience}: guide {len(guide.pages)} pages; sheet 1 page; {len(uris)} public links.')


if __name__=='__main__':
    args=argparse.ArgumentParser(description=__doc__)
    args.add_argument('--font-dir',type=Path,default=Path('/System/Library/Fonts/Supplemental'))
    args.add_argument('--audience', nargs='+', choices=EDITIONS, default=['age-18'])
    config=args.parse_args()
    register_fonts(config.font_dir)
    for audience in config.audience:
        STYLE=styles(audience)
        build_guide(STYLE, audience)
        build_sheet(STYLE, audience)
        verify_outputs(audience)
