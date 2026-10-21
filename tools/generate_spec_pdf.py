from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Iterable

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "shmavito_technical_specification.pdf"
TMP = ROOT / "tmp" / "pdfs"

PHOTO_CAR = Path(r"C:\Users\RAFCHI~1\AppData\Local\Temp\codex-clipboard-4b49316a-573e-4aaa-806e-40f9d70184ab.png")
PHOTO_STEEL = Path(r"C:\Users\RAFCHI~1\AppData\Local\Temp\codex-clipboard-28bc5895-56e2-4578-a3c1-df896ccb2f89.png")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
TOP = 20 * mm
BOTTOM = 17 * mm

INK = colors.HexColor("#111318")
GRAPHITE = colors.HexColor("#20242B")
STEEL = colors.HexColor("#59616D")
MIST = colors.HexColor("#EEF0F3")
PAPER = colors.HexColor("#F8F8F7")
WHITE = colors.white
RED = colors.HexColor("#D62929")
RED_DARK = colors.HexColor("#981F23")
BLUE = colors.HexColor("#5B7FA3")
GREEN = colors.HexColor("#278866")
AMBER = colors.HexColor("#C58A2A")
LINE = colors.HexColor("#D8DADD")


def register_fonts() -> tuple[str, str, str]:
    candidates = [
        ("Arial", Path(r"C:\Windows\Fonts\arial.ttf"), Path(r"C:\Windows\Fonts\arialbd.ttf"), Path(r"C:\Windows\Fonts\ariali.ttf")),
        ("DejaVu", Path(r"C:\Windows\Fonts\DejaVuSans.ttf"), Path(r"C:\Windows\Fonts\DejaVuSans-Bold.ttf"), Path(r"C:\Windows\Fonts\DejaVuSans-Oblique.ttf")),
    ]
    for family, regular, bold, italic in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont(family, str(regular)))
            pdfmetrics.registerFont(TTFont(f"{family}-Bold", str(bold)))
            if italic.exists():
                pdfmetrics.registerFont(TTFont(f"{family}-Italic", str(italic)))
            else:
                pdfmetrics.registerFont(TTFont(f"{family}-Italic", str(regular)))
            return family, f"{family}-Bold", f"{family}-Italic"
    raise RuntimeError("Cyrillic TrueType font was not found")


FONT, FONT_BOLD, FONT_ITALIC = register_fonts()


def crop_image(source: Path, target: Path, aspect: float, focus_x: float = 0.5, focus_y: float = 0.5) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    with PILImage.open(source) as im:
        im = im.convert("RGB")
        w, h = im.size
        current = w / h
        if current > aspect:
            nw = int(h * aspect)
            left = int((w - nw) * focus_x)
            left = max(0, min(left, w - nw))
            box = (left, 0, left + nw, h)
        else:
            nh = int(w / aspect)
            top = int((h - nh) * focus_y)
            top = max(0, min(top, h - nh))
            box = (0, top, w, top + nh)
        im.crop(box).save(target, quality=92)
    return target


class SectionLabel(Flowable):
    def __init__(self, text: str, color=RED):
        super().__init__()
        self.text = text.upper()
        self.color = color
        self.width = 170 * mm
        self.height = 8 * mm

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0.5 * mm, 32 * mm, 5.5 * mm, 2.7 * mm, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont(FONT_BOLD, 7.5)
        self.canv.drawCentredString(16 * mm, 2.25 * mm, self.text)


class StatusFlow(Flowable):
    def __init__(self):
        super().__init__()
        self.width = 170 * mm
        self.height = 27 * mm

    def draw(self):
        items = [
            ("НА ПРОВЕРКЕ", AMBER),
            ("ОДОБРЕНО", GREEN),
            ("В КАТАЛОГЕ", BLUE),
            ("СНЯТО", STEEL),
        ]
        box_w, gap, y = 35 * mm, 8 * mm, 7 * mm
        for idx, (label, color) in enumerate(items):
            x = idx * (box_w + gap)
            self.canv.setFillColor(colors.Color(color.red, color.green, color.blue, alpha=0.12))
            self.canv.setStrokeColor(color)
            self.canv.roundRect(x, y, box_w, 12 * mm, 3 * mm, fill=1, stroke=1)
            self.canv.setFillColor(color)
            self.canv.setFont(FONT_BOLD, 7.5)
            self.canv.drawCentredString(x + box_w / 2, y + 4.6 * mm, label)
            if idx < len(items) - 1:
                ax = x + box_w
                self.canv.setStrokeColor(STEEL)
                self.canv.line(ax + 1 * mm, y + 6 * mm, ax + gap - 1 * mm, y + 6 * mm)
                self.canv.line(ax + gap - 3 * mm, y + 8 * mm, ax + gap - 1 * mm, y + 6 * mm)
                self.canv.line(ax + gap - 3 * mm, y + 4 * mm, ax + gap - 1 * mm, y + 6 * mm)
        self.canv.setFillColor(RED_DARK)
        self.canv.setFont(FONT, 7)
        self.canv.drawString(0, 1 * mm, "Альтернативная ветка: На проверке -> Отклонено (обязательная причина)")


def styles():
    s = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("TitleRU", parent=s["Title"], fontName=FONT_BOLD, fontSize=27, leading=30, textColor=INK, spaceAfter=5 * mm),
        "subtitle": ParagraphStyle("SubtitleRU", parent=s["Normal"], fontName=FONT, fontSize=12, leading=17, textColor=STEEL, spaceAfter=6 * mm),
        "h1": ParagraphStyle("H1RU", parent=s["Heading1"], fontName=FONT_BOLD, fontSize=20, leading=24, textColor=INK, spaceBefore=2 * mm, spaceAfter=5 * mm),
        "h2": ParagraphStyle("H2RU", parent=s["Heading2"], fontName=FONT_BOLD, fontSize=13, leading=17, textColor=GRAPHITE, spaceBefore=4 * mm, spaceAfter=2.5 * mm),
        "h3": ParagraphStyle("H3RU", parent=s["Heading3"], fontName=FONT_BOLD, fontSize=10, leading=13, textColor=RED_DARK, spaceBefore=3 * mm, spaceAfter=1.5 * mm),
        "body": ParagraphStyle("BodyRU", parent=s["BodyText"], fontName=FONT, fontSize=9.2, leading=13.1, textColor=GRAPHITE, spaceAfter=2.2 * mm),
        "small": ParagraphStyle("SmallRU", parent=s["BodyText"], fontName=FONT, fontSize=7.7, leading=10.5, textColor=STEEL, spaceAfter=1.5 * mm),
        "bullet": ParagraphStyle("BulletRU", parent=s["BodyText"], fontName=FONT, fontSize=9, leading=12.6, leftIndent=5 * mm, firstLineIndent=-3.4 * mm, bulletIndent=0, textColor=GRAPHITE, spaceAfter=1.5 * mm),
        "callout": ParagraphStyle("CalloutRU", parent=s["BodyText"], fontName=FONT_BOLD, fontSize=10.2, leading=14.5, textColor=INK),
        "table": ParagraphStyle("TableRU", parent=s["BodyText"], fontName=FONT, fontSize=7.7, leading=10, textColor=GRAPHITE),
        "table_head": ParagraphStyle("TableHeadRU", parent=s["BodyText"], fontName=FONT_BOLD, fontSize=7.7, leading=9.5, textColor=WHITE),
        "cover_tag": ParagraphStyle("CoverTag", parent=s["BodyText"], fontName=FONT_BOLD, fontSize=8, textColor=WHITE, alignment=TA_CENTER),
        "toc": ParagraphStyle("TocRU", parent=s["BodyText"], fontName=FONT, fontSize=9.5, leading=14, textColor=GRAPHITE),
        "center": ParagraphStyle("CenterRU", parent=s["BodyText"], fontName=FONT, fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=STEEL),
    }


S = styles()


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def bullets(items: Iterable[str]):
    return [P(f"• {item}", "bullet") for item in items]


def table(headers, rows, widths, repeat=1):
    data = [[P(str(h), "table_head") for h in headers]]
    data += [[P(str(c), "table") for c in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=repeat, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, MIST]),
    ]))
    return t


def callout(title: str, text: str, color=RED):
    body = Table([[P(title, "callout")], [P(text, "body")]], colWidths=[170 * mm])
    body.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F1F3")),
        ("BOX", (0, 0), (-1, -1), 0.6, color),
        ("LINEBEFORE", (0, 0), (0, -1), 3.5, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    return body


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(INK)
    canvas.rect(0, PAGE_H - 7 * mm, PAGE_W, 7 * mm, fill=1, stroke=0)
    canvas.setFillColor(RED)
    canvas.rect(0, PAGE_H - 7 * mm, 42 * mm, 7 * mm, fill=1, stroke=0)
    canvas.setFont(FONT_BOLD, 7.5)
    canvas.setFillColor(WHITE)
    canvas.drawString(MARGIN_X, PAGE_H - 4.8 * mm, "ШМАВИТО")
    canvas.setFillColor(STEEL)
    canvas.setFont(FONT, 7)
    canvas.drawString(MARGIN_X, 8.5 * mm, "Техническое задание • версия 1.0")
    canvas.drawRightString(PAGE_W - MARGIN_X, 8.5 * mm, f"{doc.page}")
    canvas.restoreState()


def on_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.restoreState()


def cover_story(car_crop: Path, steel_crop: Path):
    car = Image(str(car_crop), width=174 * mm, height=82 * mm)
    steel = Image(str(steel_crop), width=48 * mm, height=60 * mm)
    hero = Table([[car]], colWidths=[174 * mm], rowHeights=[82 * mm])
    hero.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, STEEL)]))
    intro = [
        Spacer(1, 6 * mm),
        Table([[P("PRODUCT / UX / ENGINEERING", "cover_tag")]], colWidths=[55 * mm], rowHeights=[7 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), RED),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])),
        Spacer(1, 8 * mm),
        Paragraph("ШМАВИТО", ParagraphStyle("CoverTitle", fontName=FONT_BOLD, fontSize=38, leading=40, textColor=WHITE, spaceAfter=3 * mm)),
        Paragraph("Публичный каталог предложений Avito для сообщества STEEL", ParagraphStyle("CoverSub", fontName=FONT, fontSize=14, leading=20, textColor=colors.HexColor("#C8CDD4"))),
        Spacer(1, 8 * mm),
        hero,
        Spacer(1, 7 * mm),
    ]
    meta = Table([
        [P("ВЕРСИЯ", "table_head"), P("1.0 • 19 октября 2026", "table_head"), steel],
        [P("СТАТУС", "table_head"), P("Согласованная концепция для разработки", "table_head"), ""],
        [P("ОСНОВАТЕЛЬ", "table_head"), P("rafchibiskus • Twitch ID сохраняется после первого входа", "table_head"), ""],
    ], colWidths=[30 * mm, 90 * mm, 48 * mm], rowHeights=[20 * mm, 20 * mm, 20 * mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (1, -1), GRAPHITE),
        ("SPAN", (2, 0), (2, 2)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (1, -1), 4 * mm),
        ("BOX", (0, 0), (-1, -1), 0.6, STEEL),
        ("INNERGRID", (0, 0), (1, -1), 0.25, STEEL),
    ]))
    intro += [meta]
    return intro


def section(number: str, label: str, title: str, subtitle: str | None = None):
    items = [SectionLabel(f"{number} / {label}"), P(title, "h1")]
    if subtitle:
        items.append(P(subtitle, "subtitle"))
    return items


def build_story(car_crop: Path, steel_crop: Path):
    story = []
    story.extend(cover_story(car_crop, steel_crop))
    story.append(PageBreak())

    story += section("00", "документ", "Назначение и границы ТЗ", "Единая продуктовая, дизайнерская и техническая основа первой версии ШМАВИТО.")
    story.append(callout("Коротко", "ШМАВИТО — независимый публичный каталог ссылок на объявления Avito, которые присылают авторизованные через Twitch зрители. Каждая заявка проходит модерацию; после одобрения она становится карточкой каталога с обсуждением, лайками и персональной отметкой просмотра."))
    story += [P("Цели документа", "h2")]
    story += bullets([
        "Зафиксировать согласованное поведение первой рабочей версии (MVP).",
        "Дать дизайнеру и разработчику однозначные требования к экранам, данным, ролям и состояниям.",
        "Отделить обязательные функции от будущих расширений и снизить риск переделок.",
        "Определить критерии, по которым версия может быть принята и перенесена с локальной среды на VPS.",
    ])
    story += [P("Не входит в первую версию", "h2")]
    story += bullets([
        "Покупка, оплата, доставка или переписка с продавцом внутри ШМАВИТО.",
        "Избранное пользователя, светлая тема и мультиязычность.",
        "Копирование интерфейса Avito либо использование бренда Avito как собственного.",
        "Гарантия непрерывного автоматического импорта: при ограничениях Avito всегда доступен ручной ввод.",
    ])
    story.append(Spacer(1, 3 * mm))
    story.append(P("Содержание", "h2"))
    toc_rows = [
        ("01", "Концепция и принципы"), ("02", "Аудитории, роли и права"),
        ("03", "Информационная архитектура"), ("04", "Пользовательские сценарии"),
        ("05", "Каталог и карточка"), ("06", "Подача и импорт Avito"),
        ("07", "Модерация и админ-панель"), ("08", "Социальные функции"),
        ("09", "Статусы и фоновые задачи"), ("10", "Дизайн-система"),
        ("11", "Архитектура и стек"), ("12", "Модель данных"),
        ("13", "API и интеграции"), ("14", "Безопасность и приватность"),
        ("15", "Нефункциональные требования"), ("16", "Этапы и приёмка"),
    ]
    toc_compact = [(*toc_rows[i], *toc_rows[i + 8]) for i in range(8)]
    story.append(table(["№", "Раздел", "№", "Раздел"], toc_compact, [13 * mm, 72 * mm, 13 * mm, 72 * mm]))
    story.append(PageBreak())

    story += section("01", "продукт", "Концепция и принципы", "Премиальная предложка STEEL: автомобильный характер, быстрый каталог и прозрачная модерация.")
    story += [P("Продуктовая формула", "h2")]
    story.append(callout("От ссылки до обсуждаемой находки", "Пользователь входит через Twitch, вставляет ссылку Avito, выбирает обязательную категорию, проверяет автоматически собранные данные и отправляет заявку. Модератор редактирует и принимает решение. Одобренная карточка появляется в публичном каталоге."))
    story += [P("Основные принципы", "h2")]
    principles = [
        ("Публичность", "Одобренные объявления доступны любому посетителю; действия требуют Twitch-входа."),
        ("Кураторство", "Ничего не публикуется без решения модератора."),
        ("Быстрая подача", "Главный сценарий начинается со ссылки; ручной ввод появляется только при необходимости."),
        ("Персональный прогресс", "Просмотренные карточки сереют отдельно для каждого пользователя."),
        ("Сохранение контекста", "Снятая карточка остаётся в каталоге и сохраняет обсуждение."),
        ("Наблюдаемость", "Значимые административные действия неизменяемо записываются в журнал."),
    ]
    story.append(table(["Принцип", "Практическое следствие"], principles, [42 * mm, 128 * mm]))
    story += [P("Стартовые категории", "h2")]
    story += bullets(["Автомобили", "Другая техника", "Недвижимость", "Запчасти", "Разное"])
    story.append(P("Категории управляются из панели: создание, переименование, порядок, видимость, мягкое удаление. Выбор категории обязателен при отправке; модератор может исправить его.", "small"))
    story.append(PageBreak())

    story += section("02", "доступ", "Аудитории, роли и права")
    role_rows = [
        ("Гость", "Просмотр каталога, поиск, фильтры, карточка, переход на Avito. Без лайков, комментариев и отправки."),
        ("Пользователь", "Twitch-вход, отправка заявок, история и уведомления, лайки, комментарии и ответы, персональная отметка просмотра."),
        ("Модератор", "Очередь заявок, редактирование, одобрение/отклонение, категории, комментарии, жалобы, блокировки, лимиты, журнал."),
        ("Основатель", "Все права модератора плюс назначение ролей, глобальные настройки и полный обзор системы."),
    ]
    story.append(table(["Роль", "Возможности"], role_rows, [35 * mm, 135 * mm]))
    story += [P("Идентификация", "h2")]
    story += bullets([
        "Вход выполняется через Twitch OAuth; запрашивается минимально необходимый профиль.",
        "Публично отображаются ник и аватар отправителя объявления или автора комментария.",
        "Роль выдаётся в панели поиском по Twitch-нику, но сохраняется по неизменяемому Twitch ID.",
        "Первый основатель: rafchibiskus. Его Twitch ID фиксируется после подтверждённого входа/инициализации.",
        "Смена ника или аватара не меняет права; профиль синхронизируется при входе.",
    ])
    story += [P("Матрица критичных прав", "h2")]
    permission_rows = [
        ("Публиковать/отклонять заявки", "—", "Да", "Да"),
        ("Менять категории и лимиты", "—", "Да", "Да"),
        ("Блокировать пользователей", "—", "Да", "Да"),
        ("Назначать и отзывать роли", "—", "—", "Да"),
        ("Глобальные настройки", "—", "—", "Да"),
        ("Просматривать журнал", "—", "Да", "Да"),
    ]
    story.append(table(["Действие", "Пользователь", "Модератор", "Основатель"], permission_rows, [74 * mm, 30 * mm, 33 * mm, 33 * mm]))
    story.append(PageBreak())

    story += section("03", "структура", "Информационная архитектура")
    ia_rows = [
        ("Главная", "Приветственный экран STEEL, CTA «Предложить объявление», категории, поиск, каталог."),
        ("Каталог", "Фильтры, сортировка, сетка карточек, состояния просмотрено/снято."),
        ("Карточка", "Галерея, данные, автор, счётчики, комментарии, переход на Avito, жалоба."),
        ("Предложить", "Ссылка, импорт, обязательная категория, проверка/дополнение, правила, отправка."),
        ("Личный кабинет", "Профиль Twitch, заявки и статусы, причины отклонения, уведомления."),
        ("Админ-панель", "Дашборд, очередь, публикации, категории, комментарии, жалобы, пользователи, журнал, настройки."),
        ("Служебные", "Вход, правила, политика данных, 404/ошибка, недоступность интеграции."),
    ]
    story.append(table(["Экран", "Назначение"], ia_rows, [42 * mm, 128 * mm]))
    story += [P("Навигация", "h2")]
    story += bullets([
        "Desktop: фиксированная верхняя панель с логотипом, каталогом, категориями, поиском, CTA и профилем.",
        "Mobile: компактный header; фильтры открываются в нижней панели; CTA остаётся заметным.",
        "Админка: левое меню на широком экране и drawer на узком; счётчик ожидающих заявок виден постоянно.",
        "Приветственный экран занимает первый экран desktop-версии и сокращается на телефоне, не скрывая каталог глубоко.",
    ])
    story += [P("Приоритет устройств", "h2")]
    story.append(callout("Desktop first, responsive always", "Основная композиция и модерационная работа проектируются прежде всего для компьютера. Каталог и пользовательские действия должны полноценно адаптироваться к планшетам и телефонам без урезания функций.", BLUE))
    story.append(PageBreak())

    story += section("04", "сценарии", "Ключевые пользовательские сценарии")
    scenarios = [
        ("Отправка", "Вход Twitch → ссылка → категория → импорт → проверка полей → согласие с правилами → заявка «На проверке»."),
        ("Модерация", "Очередь → предпросмотр → исправление → одобрить либо отклонить с обязательной причиной → журнал и уведомление."),
        ("Просмотр", "Каталог → фильтр/поиск → карточка → фиксация просмотра → серое состояние у пользователя → переход на Avito."),
        ("Обсуждение", "Вход Twitch → лайк либо комментарий/ответ → мгновенная публикация → возможная жалоба/модерация."),
        ("Проверка ссылки", "Ежедневная задача → проверка доступности → «Снято с публикации» → блокировка новых реакций → автоматическое восстановление при возврате."),
        ("Роли", "Основатель ищет пользователя по нику → система разрешает Twitch ID → назначает роль → пишет событие в журнал."),
    ]
    story.append(table(["Сценарий", "Основной путь"], scenarios, [35 * mm, 135 * mm]))
    story += [P("Ошибочные и крайние случаи", "h2")]
    story += bullets([
        "Не-Avito URL отклоняется до сетевого запроса.",
        "Импорт не удался: форма переключается на ручное заполнение без потери ссылки и категории.",
        "Такая ссылка уже существует: новая заявка запрещена, пользователю показывается найденная карточка и её статус.",
        "Лимит заявок исчерпан: объяснить текущий лимит и показать активные заявки.",
        "Twitch OAuth отменён/истёк: сохранить безопасный return URL и предложить повторный вход.",
        "Оптимистичный лайк/комментарий откатывается с понятным сообщением при сетевой ошибке.",
    ])
    story.append(PageBreak())

    story += section("05", "витрина", "Каталог и карточка объявления")
    story += [P("Карточка в сетке", "h2")]
    story += bullets([
        "Обложка, название, цена, город, категория, короткий фрагмент описания.",
        "Автор: Twitch-аватар и ник; дата публикации; счётчики просмотров, лайков и комментариев.",
        "Кнопка/ссылка «Открыть на Avito»; внешний переход отмечается явно.",
        "Для автомобилей при наличии данных: год и пробег.",
        "Просмотренная карточка становится серой только для текущего пользователя и остаётся на исходной позиции.",
        "Снятая карточка серая для всех, имеет бейдж «Снято с публикации» и не принимает новые реакции.",
    ])
    story += [P("Фильтры и сортировки", "h2")]
    filter_rows = [
        ("Фильтры", "Категория, активность, просмотрено/не просмотрено, цена от/до, город."),
        ("Поиск", "По названию и описанию; регистр не учитывается."),
        ("Сортировки", "Новые, старые, популярные по лайкам, обсуждаемые по комментариям."),
        ("URL-состояние", "Фильтры, строка поиска и сортировка кодируются в query-параметрах для возврата/ссылки."),
        ("Пагинация", "Cursor-based или «Показать ещё»; состояние каталога сохраняется при возврате из карточки."),
    ]
    story.append(table(["Элемент", "Требование"], filter_rows, [36 * mm, 134 * mm]))
    story += [P("Полная карточка", "h2")]
    story += bullets([
        "Галерея до 40 изображений, первое — обложка; стрелки, полноэкранное увеличение без скачка layout.",
        "Полное описание, цена, город, категория и дополнительные найденные характеристики.",
        "Блок автора заявки не создаёт впечатление, что он является продавцом на Avito.",
        "Публичные просмотры и лайки; количество переходов на Avito видно только модераторам.",
        "Дисклеймер о независимости сервиса расположен рядом с внешней ссылкой.",
    ])
    story.append(PageBreak())

    story += section("06", "подача", "Заявка и импорт данных Avito")
    story += [P("Последовательность", "h2")]
    submit_rows = [
        ("1. URL", "Проверка HTTPS, домена avito.ru, нормализация URL и извлечение идентификатора объявления."),
        ("2. Дубликат", "Поиск по нормализованному URL и Avito item ID; повторная активная ссылка запрещена."),
        ("3. Категория", "Обязательный выбор из активного списка. Без выбора кнопка отправки недоступна."),
        ("4. Импорт", "Сервер получает разрешённые публичные метаданные страницы: заголовок, цена, город, описание, изображения."),
        ("5. Проверка", "Пользователь просматривает данные; недостающие поля заполняет вручную, галерея содержит до 40 фото."),
        ("6. Правила", "Обязательное подтверждение правил и понимания внешнего характера сделки."),
        ("7. Отправка", "Создание снимка данных и заявки «На проверке»; уведомление в личном кабинете."),
    ]
    story.append(table(["Шаг", "Поведение"], submit_rows, [30 * mm, 140 * mm]))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Ограничение интеграции", "Официальный Avito API предназначен для авторизованной работы владельца со своими объявлениями и не является универсальным API чтения любых публичных ссылок. Для ШМАВИТО используется серверное извлечение публичных метаданных с таймаутом, ограничениями частоты и ручным fallback. Реализация должна соблюдать актуальные правила Avito и быть заменяемой адаптером.", RED_DARK))
    story += [P("Минимально обязательные данные", "h2")]
    story += bullets([
        "Нормализованная ссылка, категория, название, цена либо явное «Цена не указана», город/регион, описание, минимум одно изображение.",
        "Снимок исходных значений хранится отдельно от правок модератора для аудита.",
        "Удалённые изображения с внешнего сайта не должны ломать карточку; разрешённые копии сохраняются в собственное объектное хранилище.",
    ])
    story.append(PageBreak())

    story += section("07", "операции", "Модерация и административная панель")
    story.append(StatusFlow())
    story += [P("Очередь заявок", "h2")]
    story += bullets([
        "Таблица/карточки с датой, автором, категорией, источником данных, признаком дубликата и текущим статусом.",
        "Фильтры по статусу, категории, автору и дате; поиск по URL и названию.",
        "Перед решением модератор может изменить категорию, текст, цену, город, порядок/набор изображений.",
        "Одобрение публикует карточку и создаёт уведомление пользователю.",
        "Отклонение требует заполненной причины; причина видна автору, но не публикуется в каталоге.",
        "Конкурентное редактирование защищается версией записи: второму модератору показывается конфликт.",
    ])
    story += [P("Разделы панели", "h2")]
    admin_rows = [
        ("Дашборд", "Ожидают, опубликованы, сняты, жалобы, ошибки импорта/проверок."),
        ("Категории", "Создание, название, slug, порядок, скрытие, мягкое удаление."),
        ("Пользователи", "Поиск по Twitch-нику/ID, заявки, комментарии, блокировки, роль."),
        ("Комментарии", "Поиск, контекст ветки, удаление, восстановление, блокировка автора."),
        ("Жалобы", "Тип, причина, автор, объект, решение и служебная заметка."),
        ("Настройки", "Лимит активных заявок, cooldown, параметры проверки ссылок, визуальные настройки."),
        ("Журнал", "Кто, когда, действие, объект, старое/новое значение, IP, correlation ID."),
    ]
    story.append(table(["Раздел", "Содержимое"], admin_rows, [35 * mm, 135 * mm]))
    story.append(PageBreak())

    story += section("08", "сообщество", "Лайки, комментарии и жалобы")
    interaction_rows = [
        ("Лайк", "Только после Twitch-входа; один на пользователя; можно снять; своё объявление лайкать нельзя."),
        ("Комментарий", "Публикуется сразу; поддерживает ответы; автор может удалить свой, модератор — любой."),
        ("Ответ", "Привязан к родительскому комментарию; глубина отображения ограничена одним уровнем для читаемости."),
        ("Жалоба", "На карточку или комментарий; причина обязательна; повторная открытая жалоба от пользователя блокируется."),
        ("Снятая карточка", "Существующие реакции читаются, новые лайки/комментарии запрещены."),
        ("Удаление", "Мягкое: текст скрывается, структура обсуждения сохраняется; модератор может восстановить."),
    ]
    story.append(table(["Функция", "Правило"], interaction_rows, [36 * mm, 134 * mm]))
    story += [P("Защита сообщества", "h2")]
    story += bullets([
        "Rate limiting для комментариев, лайков, жалоб и попыток отправки.",
        "Санитизация текста и запрет HTML; ссылки в комментариях по умолчанию неактивны либо проходят безопасный renderer.",
        "Временные и постоянные блокировки. Заблокированный пользователь может читать каталог, но не отправлять заявки и реакции.",
        "Удаление и блокировка всегда требуют служебной причины и попадают в журнал.",
        "Базовая антиспам-эвристика: частота, повтор текста, слишком большое число упоминаний/ссылок.",
    ])
    story += [P("Уведомления", "h2")]
    story += bullets([
        "Внутренний центр уведомлений с непрочитанным счётчиком.",
        "События MVP: заявка одобрена, заявка отклонена с причиной, ответ на комментарий, решение по жалобе при необходимости.",
        "Уведомление содержит безопасную внутреннюю ссылку на объект и дату; поддерживает отметить прочитанным/все прочитанными.",
    ])
    story.append(PageBreak())

    story += section("09", "состояния", "Жизненный цикл и фоновые задачи")
    status_rows = [
        ("pending", "На проверке", "Не видна в каталоге; доступна автору и модераторам."),
        ("approved", "Опубликовано", "Активная карточка каталога; реакции разрешены."),
        ("rejected", "Отклонено", "Видна автору с причиной; не публикуется."),
        ("unavailable", "Снято с публикации", "Серая публичная карточка; реакции только для чтения."),
        ("deleted", "Удалено", "Скрыто из обычных списков, доступно для восстановления уполномоченным."),
    ]
    story.append(table(["Код", "Название", "Поведение"], status_rows, [28 * mm, 42 * mm, 100 * mm]))
    story += [P("Ежедневная проверка доступности", "h2")]
    story += bullets([
        "Запускается раз в сутки по расписанию; обрабатывает только опубликованные и ранее снятые карточки.",
        "HTTP-проверка выполняется через отдельный адаптер с таймаутом, контролем редиректов, ограничением параллельности и повтором временных ошибок.",
        "Надёжный признак недоступности переводит карточку в unavailable; изменение журналируется.",
        "При повторной доступности статус автоматически возвращается в approved; событие журналируется.",
        "Сетевой таймаут, 429 или защитная страница не считаются доказательством снятия; задача помечает проверку как техническую ошибку.",
        "Панель показывает последнюю успешную проверку, результат, количество ошибок и возможность ручного перезапуска одной карточки.",
    ])
    story += [P("Персональный просмотр", "h2")]
    story += bullets([
        "Для авторизованного пользователя создаётся уникальная запись item_view при открытии полной карточки или переходе на Avito.",
        "Повторные открытия обновляют lastViewedAt и увеличивают агрегированный счётчик, не создавая дубликат уникального просмотра.",
        "В каталоге просмотренная карточка визуально приглушена, но не меняет позицию.",
        "Гость получает обычный каталог; его временные просмотры можно хранить только локально в браузере и не учитывать как аккаунтные.",
    ])
    story.append(PageBreak())

    story += section("10", "визуал", "Дизайн-направление и UI-система")
    story.append(callout("Визуальный образ", "Ночная автомобильная фотография, матовый графит, мокрый асфальт, карбон и холодный свет фар. Красный применяется как редкий функциональный акцент, а не как сплошная заливка. Интерфейс должен выглядеть премиально, но оставаться быстрым каталогом.", RED))
    story += [P("Использование образа STEEL", "h2")]
    story += bullets([
        "Полноэкранный приветственный hero на desktop с портретом STEEL и автомобильным окружением.",
        "На внутренних страницах — компактная айдентика без повторения крупного портрета.",
        "Присланные изображения используются только с подтверждённого разрешения; в продакшене хранится оптимизированная версия и атрибуция источника во внутренней медиатеке.",
        "Избегать визуальной имитации интерфейса Avito, BMW и Twitch; логотип ШМАВИТО должен быть самостоятельным.",
    ])
    palette = [
        ("Graphite", "#111318", "Основной фон/текст"),
        ("Carbon", "#20242B", "Поверхности"),
        ("Steel", "#59616D", "Вторичный текст"),
        ("Cold white", "#F8F8F7", "Светлая типографика"),
        ("Signal red", "#D62929", "CTA, ошибки, акцент"),
        ("Success", "#278866", "Одобрено/доступно"),
    ]
    story.append(table(["Токен", "HEX", "Применение"], palette, [42 * mm, 32 * mm, 96 * mm]))
    story += [P("Компоненты и состояния", "h2")]
    story += bullets([
        "Карточка: default, hover/focus, viewed, unavailable, loading skeleton.",
        "Кнопки: primary red, secondary outline, quiet text; disabled всегда отличим от loading.",
        "Статусы сопровождаются текстом/иконкой, не только цветом.",
        "Фокус клавиатуры контрастный; интерактивные зоны не меньше 44×44 px на touch-экранах.",
        "Анимации короткие и функциональные; поддерживается prefers-reduced-motion.",
    ])
    story.append(PageBreak())

    story += section("11", "технологии", "Архитектура и рекомендуемый стек")
    stack_rows = [
        ("Web", "Next.js (App Router), React, TypeScript", "SSR/SEO каталога, единый full-stack проект, адаптивный UI."),
        ("UI", "Tailwind CSS + собственные компоненты", "Быстрая реализация согласованной тёмной дизайн-системы."),
        ("Данные", "PostgreSQL + Prisma", "Транзакции, связи, миграции, полнотекстовый поиск на старте."),
        ("Авторизация", "Auth.js/custom OAuth adapter для Twitch", "Минимальные scope, серверная сессия, Twitch ID как внешний ключ."),
        ("Очередь", "Redis + BullMQ", "Импорт, ежедневные проверки, повтор задач и наблюдаемость."),
        ("Файлы", "S3-compatible storage; локально MinIO", "Изображения и независимость от внешних URL."),
        ("Развёртывание", "Docker Compose", "Одинаковая локальная среда и последующий перенос на VPS."),
        ("Тесты", "Vitest, Testing Library, Playwright", "Логика, компоненты и критичные end-to-end сценарии."),
    ]
    story.append(table(["Слой", "Выбор", "Причина"], stack_rows, [27 * mm, 57 * mm, 86 * mm]))
    story += [P("Компоненты системы", "h2")]
    story += bullets([
        "Next.js web/API: каталог, личный кабинет, админка, OAuth callback и внутренние API.",
        "Worker: импорт метаданных, обработка изображений, ежедневная проверка ссылок, уведомления.",
        "PostgreSQL: источник истины для пользователей, заявок, карточек, реакций и журнала.",
        "Redis: очередь задач, rate limiting и краткоживущие блокировки; не является постоянным хранилищем.",
        "MinIO/S3: оригиналы и оптимизированные изображения; публичная раздача только безопасных производных файлов.",
    ])
    story += [P("Локальный запуск", "h2")]
    story.append(callout("Одна команда", "docker compose up поднимает PostgreSQL, Redis, MinIO и приложение/worker. Seed-команда создаёт демонстрационные категории, вымышленные объявления, комментарии и состояния без реальных пользовательских данных.", BLUE))
    story.append(PageBreak())

    story += section("12", "данные", "Модель данных")
    entities = [
        ("User", "id, twitchId unique, login, displayName, avatarUrl, role, status, timestamps"),
        ("UserBan", "userId, type temporary/permanent, reason, startsAt, endsAt, createdBy"),
        ("Category", "id, name, slug unique, position, isVisible, deletedAt"),
        ("Submission", "id, authorId, sourceUrl, normalizedUrl, externalItemId, categoryId, status, rejectionReason, rawSnapshot, timestamps"),
        ("Listing", "id, submissionId, title, description, price, city, categoryId, state, publishedAt, unavailableAt, lastCheckedAt"),
        ("ListingImage", "listingId/submissionId, storageKey, sourceUrl, width, height, position, isCover"),
        ("Like", "userId + listingId unique, createdAt"),
        ("Comment", "id, listingId, authorId, parentId nullable, body, deletedAt, deletedBy"),
        ("ItemView", "userId + listingId unique, firstViewedAt, lastViewedAt, openCount"),
        ("Report", "reporterId, targetType, targetId, reason, status, resolvedBy, resolvedAt"),
        ("Notification", "userId, type, payload, readAt, createdAt"),
        ("AvailabilityCheck", "listingId, result, httpStatus, checkedAt, errorCode, durationMs"),
        ("AuditLog", "actorId, action, targetType/id, beforeJson, afterJson, ipHash/ip, correlationId, createdAt"),
        ("Setting", "key unique, typedValue, updatedBy, updatedAt"),
    ]
    story.append(table(["Сущность", "Ключевые поля"], entities, [42 * mm, 128 * mm]))
    story += [P("Инварианты", "h2")]
    story += bullets([
        "Нормализованный URL/внешний ID не может иметь две активные заявки или карточки.",
        "Like уникален по паре пользователь–карточка; автор заявки не может лайкнуть свою карточку.",
        "Категория заявки обязательна и должна быть активной на момент отправки.",
        "Отклонённая заявка всегда имеет непустую причину.",
        "Все модерационные изменения и смены ролей выполняются транзакционно вместе с AuditLog.",
    ])
    story.append(PageBreak())

    story += section("13", "контракты", "API и внешние интеграции")
    api_rows = [
        ("GET /api/listings", "Каталог: cursor, query, category, price, city, viewed, status, sort."),
        ("GET /api/listings/:id", "Полная карточка и разрешённые данные автора/реакций."),
        ("POST /api/submissions/import", "Нормализует URL и ставит импорт в очередь."),
        ("POST /api/submissions", "Создаёт заявку после валидации, правил, лимита и проверки дубликата."),
        ("POST/DELETE /api/listings/:id/like", "Добавить/снять собственный лайк."),
        ("POST /api/listings/:id/comments", "Комментарий или ответ; rate limit и проверка блокировки."),
        ("POST /api/reports", "Жалоба на карточку/комментарий."),
        ("GET /api/me/*", "Профиль, заявки, уведомления, отметка прочтения."),
        ("/api/admin/*", "Очередь, решение, категории, пользователи, блокировки, роли, настройки, журнал."),
        ("GET /api/auth/twitch/callback", "OAuth callback с state/PKCE, синхронизация Twitch-профиля."),
    ]
    story.append(table(["Контракт", "Назначение"], api_rows, [60 * mm, 110 * mm]))
    story += [P("Правила API", "h2")]
    story += bullets([
        "JSON, единый формат ошибок: code, message, fieldErrors, correlationId.",
        "Схемы запросов/ответов валидируются (например, Zod); неизвестные поля отбрасываются или отклоняются.",
        "Авторизация и RBAC проверяются на сервере для каждого защищённого маршрута; UI не считается защитой.",
        "Мутации лайков, решений и ролей идемпотентны либо защищены idempotency key/version.",
        "OpenAPI-описание внутренних контрактов генерируется или поддерживается рядом с кодом.",
    ])
    story += [P("Twitch", "h2")]
    story += bullets([
        "Запрашивать только scope, необходимый для идентификации профиля; не просить права на управление каналом.",
        "Access/refresh tokens хранятся зашифрованно только если они нужны после входа; иначе хранится серверная сессия и профиль.",
        "Ник используется как интерфейс поиска ролей, Twitch ID — как фактическая идентичность.",
    ])
    story.append(PageBreak())

    story += section("14", "защита", "Безопасность, приватность и правила")
    security_rows = [
        ("OAuth", "state, PKCE где применимо, строгий redirect URI, secure/httpOnly/sameSite cookies, ротация сессий."),
        ("SSRF", "Импорт принимает только HTTPS и разрешённые хосты Avito; DNS/IP проверяются до и после редиректа; закрытые сети запрещены."),
        ("Контент", "Экранирование/санитизация, CSP, запрет произвольного HTML, безопасная обработка изображений."),
        ("CSRF", "SameSite + CSRF-токен/проверка origin для мутаций, особенно админских."),
        ("Rate limit", "По пользователю и IP для OAuth, импорта, заявок, комментариев, лайков, жалоб."),
        ("Права", "Server-side RBAC, повторная проверка основателя для ролей и глобальных настроек."),
        ("Секреты", "Только переменные окружения/secret store; .env не коммитится; шаблон без значений."),
        ("Аудит", "Append-only журнал; целостность, ограниченный доступ, экспорт для расследования."),
        ("Резервирование", "Автоматические backup PostgreSQL и метаданных хранилища; проверка восстановления."),
    ]
    story.append(table(["Область", "Требование"], security_rows, [32 * mm, 138 * mm]))
    story += [P("Правила публикации", "h2")]
    story += bullets([
        "Запрещены мошенничество, нелегальные товары/услуги, персональные данные третьих лиц, взрослый и опасный контент.",
        "Пользователь подтверждает правила перед каждой отправкой либо после изменения версии правил.",
        "ШМАВИТО не является Avito, не выступает продавцом или стороной сделки и не гарантирует достоверность объявления.",
        "Все сделки и коммуникации происходят на внешнем сайте; внешний переход обозначен явно.",
        "Нужны публичные страницы правил и политики обработки данных Twitch-профиля.",
    ])
    story.append(PageBreak())

    story += section("15", "качество", "Нефункциональные требования")
    nfr = [
        ("Производительность", "LCP каталога ≤ 2.5 с на типичном broadband; lazy image; WebP/AVIF; responsive sizes."),
        ("Доступность", "WCAG 2.2 AA как ориентир: клавиатура, focus, контраст, подписи, reduced motion."),
        ("SEO", "SSR карточек, title/description, canonical, sitemap только активных страниц; снятые noindex по решению."),
        ("Надёжность", "Идемпотентные jobs, retries с backoff, dead-letter queue, транзакции на модерации."),
        ("Наблюдаемость", "Структурные логи, correlation ID, метрики очередей/ошибок, health endpoints."),
        ("Совместимость", "Актуальные Chrome, Edge, Firefox, Safari; адаптив 360 px–широкий desktop."),
        ("Локализация", "Первая версия только RU; строки вынесены из компонентов для будущего i18n."),
        ("Данные", "Времена хранятся UTC, отображаются в локальной зоне; денежные значения целыми копейками/рублями по модели."),
    ]
    story.append(table(["Область", "Целевое требование"], nfr, [36 * mm, 134 * mm]))
    story += [P("Аналитика продукта", "h2")]
    story += bullets([
        "Публично: просмотры карточки, лайки и комментарии.",
        "Только в панели: переходы на Avito, конверсия отправки, доля успешного импорта, время модерации, ошибки проверки ссылок.",
        "Не собирать лишние персональные данные; IP в журнале хранить только при обоснованной необходимости и ограниченном сроке либо в хешированном виде.",
    ])
    story += [P("Демонстрационные данные", "h2")]
    story += bullets([
        "Seed содержит все пять категорий, активные/просмотренные/снятые карточки, комментарии и ответы, жалобы и уведомления.",
        "Все объявления вымышлены, внешние ссылки не ведут на реальные продажи, фотографии имеют разрешённый источник.",
        "Демо-режим позволяет оценить каталог и админку до настройки Twitch OAuth и импортера.",
    ])
    story.append(PageBreak())

    story += section("16", "delivery", "Этапы разработки и критерии приёмки")
    stages = [
        ("0. Основа", "Репозиторий, архитектура, Docker Compose, БД, дизайн-токены, линтеры и CI."),
        ("1. Identity", "Twitch OAuth, сессии, роли, основатель, профиль и базовый журнал."),
        ("2. Подача", "Категории, ссылка, импорт-адаптер, ручной fallback, изображения, лимиты, дубликаты."),
        ("3. Модерация", "Очередь, редактирование, решение, причина, уведомления, мягкое удаление."),
        ("4. Каталог", "Главная STEEL, поиск, фильтры, карточка, просмотренность, внешние переходы."),
        ("5. Сообщество", "Лайки, комментарии/ответы, жалобы, блокировки и модерация."),
        ("6. Фоновые задачи", "Суточная проверка, снятие/восстановление, dashboard ошибок."),
        ("7. Hardening", "E2E, доступность, безопасность, backup, документация и подготовка VPS."),
    ]
    story.append(table(["Этап", "Результат"], stages, [35 * mm, 135 * mm]))
    story += [P("Приёмочные критерии MVP", "h2")]
    acceptance = [
        "Пользователь входит через Twitch; ник и аватар отображаются, повторный вход узнаёт тот же Twitch ID.",
        "Без категории заявку отправить невозможно; дубликат активной ссылки не создаётся.",
        "При успешном импорте поля заполняются, при ошибке доступен полноценный ручной ввод; галерея содержит до 40 фото.",
        "Модератор может исправить карточку, одобрить либо отклонить только с причиной; пользователь получает уведомление.",
        "Одобренное объявление появляется в публичном каталоге и корректно фильтруется/ищется/сортируется.",
        "После открытия карточка сереет только у этого пользователя и не меняет место в выдаче.",
        "Лайк уникален, снимается, и автор не может лайкнуть собственную публикацию.",
        "Комментарии и ответы публикуются сразу; удаление/жалоба/блокировка работают с аудитом.",
        "Суточная проверка переводит подтверждённо недоступную карточку в «Снято с публикации» и восстанавливает её при возврате.",
        "Снятая карточка остаётся видимой, но не принимает лайки и комментарии.",
        "Основатель rafchibiskus назначает роли по нику, система сохраняет Twitch ID; модератор не может назначать роли.",
        "Категории, лимиты и интервал отправки меняются в панели без изменения кода.",
        "Все критичные действия появляются в неизменяемом журнале со старым/новым значением.",
        "Desktop-интерфейс завершён, мобильная адаптация не теряет пользовательских функций.",
        "Проект запускается локально одной документированной командой и содержит безопасный demo seed.",
    ]
    story += bullets(acceptance)
    story.append(PageBreak())

    story += section("17", "решения", "Зафиксированные решения и открытые технические проверки")
    fixed = [
        ("Бренд", "ШМАВИТО; доменное имя shmavito; слоган не используется."),
        ("Каталог", "Публичный; приветственный экран STEEL; тёмная тема; desktop-first responsive."),
        ("Identity", "Twitch OAuth; публичные ник/аватар; основатель rafchibiskus."),
        ("Модерация", "На проверке → Одобрено/Отклонено; причина отклонения обязательна."),
        ("Сообщество", "Лайки, комментарии и ответы; свои карточки лайкать нельзя; жалобы включены."),
        ("Ссылки", "Автоимпорт с ручным fallback; дубликаты запрещены; проверка раз в сутки."),
        ("Состояния", "Просмотренная карточка серая персонально; снятая — серая для всех, остаётся в каталоге."),
        ("Хостинг", "Сначала локально, затем VPS с Docker Compose."),
    ]
    story.append(table(["Тема", "Решение"], fixed, [40 * mm, 130 * mm]))
    story += [P("Перед началом интеграционного этапа проверить", "h2")]
    story += bullets([
        "Зарегистрировать Twitch OAuth-приложение, согласовать callback URL для local и будущего домена.",
        "Подтвердить фактический Twitch ID основателя после первого доверенного входа.",
        "Проверить актуальные правила и техническую доступность публичных метаданных Avito на тестовых ссылках разных категорий.",
        "Определить политику хранения оригинальных изображений, IP и сроков audit/availability logs.",
        "Подготовить финальные оптимизированные бренд-фотографии и при необходимости простой самостоятельный wordmark ШМАВИТО.",
    ])
    story.append(Spacer(1, 8 * mm))
    story.append(callout("Готовность", "После утверждения этого ТЗ можно начинать этап 0: каркас проекта, локальная инфраструктура и дизайн-система. Любое изменение обязательной логики после старта оформляется как отдельное решение с обновлением версии документа.", GREEN))
    story.append(Spacer(1, 12 * mm))
    story.append(P("Конец документа • ШМАВИТО v1.0", "center"))
    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    if not PHOTO_CAR.exists() or not PHOTO_STEEL.exists():
        raise FileNotFoundError("Attached reference images are missing")
    car_crop = crop_image(PHOTO_CAR, TMP / "cover_car.jpg", aspect=174 / 82, focus_x=0.55, focus_y=0.62)
    steel_crop = crop_image(PHOTO_STEEL, TMP / "cover_steel.jpg", aspect=48 / 60, focus_x=0.50, focus_y=0.58)

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        rightMargin=MARGIN_X,
        leftMargin=MARGIN_X,
        topMargin=TOP,
        bottomMargin=BOTTOM,
        title="ШМАВИТО — техническое задание",
        author="ШМАВИТО",
        subject="Концепция и техническое задание публичного каталога предложений Avito для сообщества STEEL",
    )
    frame = Frame(MARGIN_X, BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - TOP - BOTTOM, id="body", showBoundary=0)
    cover_frame = Frame(MARGIN_X, 12 * mm, PAGE_W - 2 * MARGIN_X, PAGE_H - 22 * mm, id="cover", showBoundary=0)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover, autoNextPageTemplate="content"),
        PageTemplate(id="content", frames=[frame], onPage=on_page),
    ])
    doc.build(build_story(car_crop, steel_crop))
    print(OUT)


if __name__ == "__main__":
    main()
