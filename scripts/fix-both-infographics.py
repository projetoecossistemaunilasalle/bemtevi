import os
from PIL import Image, ImageDraw, ImageFont

def get_scaled_footer(target_width, footer_path='extracted_footer.png'):
    footer = Image.open(footer_path).convert('RGB')
    scale = target_width / footer.width
    new_h = int(footer.height * scale)
    return footer.resize((target_width, new_h), Image.Resampling.LANCZOS), new_h

def draw_wrapped_text(draw, text, font, fill, x, y, max_width, line_spacing=4):
    words = text.split(' ')
    lines = []
    current_line = []
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = font.getbbox(test_line)
        if bbox[2] - bbox[0] <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))
    
    current_y = y
    for line in lines:
        draw.text((x, current_y), line, font=font, fill=fill)
        bbox = font.getbbox(line)
        h = max(bbox[3] - bbox[1], font.size)
        current_y += h + line_spacing
    return current_y

def draw_centered_text(draw, text, font, fill, center_x, y):
    bbox = font.getbbox(text)
    w = bbox[2] - bbox[0]
    draw.text((center_x - w // 2, y), text, font=font, fill=fill)

def fix_mindfulness():
    print("Processing Mindfulness Infographic...")
    orig_path = r'C:\Users\Vitor\.gemini\antigravity\brain\280fade3-abb0-4709-b568-4c7ee7fe83e0\infografico_mindfulness_educadores_1789452489610.jpg'
    im = Image.open(orig_path).convert('RGB')
    draw = ImageDraw.Draw(im)

    font_title_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 30)
    font_card_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 17)
    font_badge = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 19)
    font_body = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
    font_body_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 14)
    font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)

    color_green = (0, 66, 20)
    color_body = (35, 60, 42)
    color_amber = (245, 175, 25)
    white = (255, 255, 255)

    # 1. Top Logo lockup
    bg_top = im.getpixel((200, 50))
    draw.rectangle([250, 20, 600, 95], fill=bg_top)
    logo_rgba = Image.open('public/logo.png').convert('RGBA')
    logo_mind = logo_rgba.copy()
    logo_mind.thumbnail((46, 46), Image.Resampling.LANCZOS)
    bbox = font_title_bold.getbbox('BemTeVi')
    text_w = bbox[2] - bbox[0]
    total_w = logo_mind.width + 12 + text_w
    start_x = (im.width - total_w) // 2
    logo_y = 35
    text_y = logo_y + (logo_mind.height - (bbox[3] - bbox[1])) // 2 - 2
    im.paste(logo_mind, (start_x, logo_y), mask=logo_mind)
    draw.text((start_x + logo_mind.width + 12, text_y), 'BemTeVi', fill=color_green, font=font_title_bold)

    # Subtitle under title
    draw.rectangle([70, 183, 780, 225], fill=bg_top)
    sub_text = 'Baseado nas diretrizes clínicas do Dr. Cristiano Nabuco (MDH / FBTC)'
    draw_centered_text(draw, sub_text, font_sub, (75, 100, 80), im.width // 2, 192)

    # Card 1: O que é Atenção Plena
    draw.rectangle([75, 315, 395, 465], fill=white)
    c1_text = 'Estar presente não é esvaziar a cabeça, mas perceber o que acontece dentro e fora de você no aqui e agora — com gentileza e sem julgamento.'
    draw_wrapped_text(draw, c1_text, font_body, color_body, 82, 325, 305, line_spacing=5)

    # Card 2: Desacelerar o Piloto Automático
    draw.rectangle([455, 315, 780, 465], fill=white)
    c2_text = 'Entre aulas, prazos e correções, entramos no modo automático. Uma pausa intencional rompe a pressa e devolve clareza às suas escolhas.'
    draw_wrapped_text(draw, c2_text, font_body, color_body, 465, 325, 305, line_spacing=5)

    # Card 3: A Pausa Consciente de 3 Minutos
    draw.rectangle([65, 585, 405, 1210], fill=white)
    draw.text((80, 595), 'Três etapas breves para reancorar sua presença:', fill=(70, 95, 75), font=font_body)

    # Step 1
    draw.ellipse([80, 645, 120, 685], fill=color_amber)
    draw.text((93, 652), '1', fill=white, font=font_badge)
    draw.text((130, 650), '1. Reconhecer', fill=color_green, font=font_card_title)
    draw_wrapped_text(draw, 'Pare um instante. Observe sua mente e corpo, acolhendo o cansaço sem tentar mudar nada.', font_body, color_body, 130, 676, 260, line_spacing=4)

    # Step 2
    draw.ellipse([80, 795, 120, 835], fill=color_amber)
    draw.text((93, 802), '2', fill=white, font=font_badge)
    draw.text((130, 800), '2. Focar', fill=color_green, font=font_card_title)
    draw_wrapped_text(draw, 'Direcione toda a atenção para a respiração. Sinta o ar entrando e o ritmo suave do peito.', font_body, color_body, 130, 826, 260, line_spacing=4)

    # Step 3
    draw.ellipse([80, 945, 120, 985], fill=color_amber)
    draw.text((93, 952), '3', fill=white, font=font_badge)
    draw.text((130, 950), '3. Expandir', fill=color_green, font=font_card_title)
    draw_wrapped_text(draw, 'Expanda a percepção para todo o corpo e o ambiente. Sinta os pés firmes no chão antes da aula.', font_body, color_body, 130, 976, 260, line_spacing=4)

    # Card 4: Ancoragem nos Sentidos
    draw.rectangle([455, 780, 785, 965], fill=white)
    draw.text((465, 785), 'Quando a cabeça acelerar, ancore-se nos sentidos:', fill=color_body, font=font_body)
    draw.text((465, 815), '• Olhe: Note 3 cores ou formas na sala.', fill=color_green, font=font_body_bold)
    draw.text((465, 842), '• Sinta: Perceba o apoio dos pés no chão.', fill=color_green, font=font_body_bold)
    draw.text((465, 869), '• Ouça: Escute os sons ao redor sem julgá-los.', fill=color_green, font=font_body_bold)

    # Card 5: Autocompaixão e Gentileza Docente
    draw.rectangle([455, 1080, 785, 1205], fill=white)
    c5_txt = 'Você não precisa dar conta de tudo a cada instante. Trate o seu cansaço com a mesma compreensão carinhosa que você oferece a quem precisa de cuidado.'
    draw_wrapped_text(draw, c5_txt, font_body, color_body, 465, 1090, 310, line_spacing=5)

    # Canvas extension with footer
    footer, fh = get_scaled_footer(im.width)
    bg_bottom = im.getpixel((im.width // 2, im.height - 10))
    new_h = im.height + fh
    new_im = Image.new('RGB', (im.width, new_h), bg_bottom)
    new_im.paste(im, (0, 0))
    new_im.paste(footer, (0, im.height))

    out_path = 'public/flow-visuals/infografico-mindfulness-educadores.jpg'
    new_im.save(out_path, quality=95)
    print(f"Mindfulness saved to {out_path} ({new_im.width}x{new_im.height})")
    return new_im

def fix_cuidar_educador():
    print("Processing Cuidar Educador Infographic...")
    orig_path = r'C:\Users\Vitor\.gemini\antigravity\brain\bc62aeea-c92e-40b1-a434-dde91e5a18f7\infografico_cuidar_educador_1789452295769.jpg'
    im = Image.open(orig_path).convert('RGB')
    draw = ImageDraw.Draw(im)

    font_pillar = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 17)
    font_alert_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 17)
    font_alert_body = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
    font_rede_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)

    color_green = (0, 66, 20)
    color_body = (35, 60, 42)
    color_alert_sub = (35, 55, 38)
    color_rede_sub = (50, 75, 55)
    white = (255, 255, 255)
    bg_alert = (251, 236, 206)
    bg_cream = (247, 244, 227)

    # 1. Top Right Logo
    draw.rectangle([680, 20, 840, 120], fill=bg_cream)
    logo_rgba = Image.open('public/logo.png').convert('RGBA')
    logo_cuidar = logo_rgba.copy()
    logo_cuidar.thumbnail((68, 68), Image.Resampling.LANCZOS)
    im.paste(logo_cuidar, (740, 30), mask=logo_cuidar)

    # 2. Four Pillars in PT-BR
    # Card 1: Sono & Repouso (center x = 135)
    draw.rectangle([55, 490, 215, 585], fill=white)
    draw_centered_text(draw, 'Sono &', font_pillar, color_green, 135, 508)
    draw_centered_text(draw, 'Repouso', font_pillar, color_green, 135, 532)

    # Card 2: Limites Saudáveis (center x = 325)
    draw.rectangle([245, 485, 405, 585], fill=white)
    draw_centered_text(draw, 'Limites', font_pillar, color_green, 325, 508)
    draw_centered_text(draw, 'Saudáveis', font_pillar, color_green, 325, 532)

    # Card 3: Pausas & Respiração (center x = 520)
    draw.rectangle([440, 490, 600, 585], fill=white)
    draw_centered_text(draw, 'Pausas &', font_pillar, color_green, 520, 508)
    draw_centered_text(draw, 'Respiração', font_pillar, color_green, 520, 532)

    # Card 4: Conexão Social (center x = 715)
    draw.rectangle([635, 490, 795, 585], fill=white)
    draw_centered_text(draw, 'Conexão', font_pillar, color_green, 715, 508)
    draw_centered_text(draw, 'Social', font_pillar, color_green, 715, 532)

    # 3. Sinais de Alerta
    # Left: Exaustão Crônica
    draw.rectangle([145, 740, 420, 840], fill=bg_alert)
    draw.text((150, 745), 'Exaustão Crônica:', fill=color_green, font=font_alert_title)
    draw_wrapped_text(draw, 'Esgotamento persistente que não passa com o descanso', font_alert_body, color_alert_sub, 150, 772, 250, line_spacing=4)

    # Right: Insônia Persistente
    draw.rectangle([565, 740, 805, 840], fill=bg_alert)
    draw.text((570, 745), 'Insônia Persistente:', fill=color_green, font=font_alert_title)
    draw_wrapped_text(draw, 'Dificuldade frequente para iniciar ou manter o sono', font_alert_body, color_alert_sub, 570, 772, 230, line_spacing=4)

    # 4. Rede de Apoio subtext
    draw.rectangle([40, 1110, 810, 1205], fill=bg_cream)
    # SUS (center 136)
    draw_centered_text(draw, 'Atenção Básica', font_rede_sub, color_rede_sub, 136, 1115)
    draw_centered_text(draw, 'e Rede UBS', font_rede_sub, color_rede_sub, 136, 1133)

    # CAPS (center 328)
    draw_centered_text(draw, 'Cuidado em', font_rede_sub, color_rede_sub, 328, 1115)
    draw_centered_text(draw, 'Saúde Mental', font_rede_sub, color_rede_sub, 328, 1133)

    # CVV 188 (center 527)
    draw_centered_text(draw, 'Apoio Emocional', font_rede_sub, color_rede_sub, 527, 1115)
    draw_centered_text(draw, '24h Gratuito', font_rede_sub, color_rede_sub, 527, 1133)

    # Plataforma CHA Fiocruz (center 705)
    draw_centered_text(draw, 'Acolhimento aos', font_rede_sub, color_rede_sub, 705, 1115)
    draw_centered_text(draw, 'Educadores', font_rede_sub, color_rede_sub, 705, 1133)

    # 5. Canvas extension with footer
    footer, fh = get_scaled_footer(im.width)
    new_h = im.height + fh
    new_im = Image.new('RGB', (im.width, new_h), bg_cream)
    new_im.paste(im, (0, 0))
    new_im.paste(footer, (0, im.height))

    out1 = 'public/flow-visuals/infografico-cuidar-educador.jpg'
    out2 = 'public/infografico_cuidar_educador.jpg'
    new_im.save(out1, quality=95)
    new_im.save(out2, quality=95)
    print(f"Cuidar Educador saved to {out1} and {out2} ({new_im.width}x{new_im.height})")
    return new_im

if __name__ == '__main__':
    fix_mindfulness()
    fix_cuidar_educador()
