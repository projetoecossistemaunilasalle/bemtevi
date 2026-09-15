import os
from PIL import Image, ImageDraw, ImageFont

def get_scaled_footer(target_width, footer_path='extracted_footer.png'):
    footer = Image.open(footer_path).convert('RGB')
    scale = target_width / footer.width
    new_h = int(footer.height * scale)
    return footer.resize((target_width, new_h), Image.Resampling.LANCZOS), new_h

def patch_infographics():
    footer_img = Image.open('extracted_footer.png').convert('RGB')
    logo_rgba = Image.open('public/logo.png').convert('RGBA')
    font_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 30)

    # 1. Manejo de Emoções
    print("Patching infografico-manejo-emocoes.jpg...")
    im = Image.open('public/flow-visuals/infografico-manejo-emocoes.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-manejo-emocoes.jpg', quality=95)

    # 2. Resiliência Ativa
    print("Patching infografico-resiliencia-ativa.jpg...")
    im = Image.open('public/flow-visuals/infografico-resiliencia-ativa.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-resiliencia-ativa.jpg', quality=95)

    # 3. Respiração 4-2-6
    print("Patching infografico-respiracao-426.jpg...")
    im = Image.open('public/flow-visuals/infografico-respiracao-426.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-respiracao-426.jpg', quality=95)
    im.save('public/infografico-respiracao-426.jpg', quality=95)

    # 4. Mitos vs Fatos
    print("Patching infografico-mitos-fatos.jpg...")
    im = Image.open('public/flow-visuals/infografico-mitos-fatos.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    # Append footer
    new_im = Image.new('RGB', (im.width, im.height + fh), (255, 255, 255))
    new_im.paste(im, (0, 0))
    new_im.paste(footer, (0, im.height))
    new_im.save('public/flow-visuals/infografico-mitos-fatos.jpg', quality=95)

    # 5. Mindfulness para Professores
    print("Patching infografico-mindfulness-educadores.jpg...")
    im = Image.open('public/flow-visuals/infografico-mindfulness-educadores.jpg').convert('RGB')
    bg_col = im.getpixel((200, 50))
    draw = ImageDraw.Draw(im)
    draw.rectangle([250, 20, 600, 95], fill=bg_col)

    logo_mind = logo_rgba.copy()
    logo_mind.thumbnail((48, 48), Image.Resampling.LANCZOS)
    bbox = font_bold.getbbox('BemTeVi')
    text_w = bbox[2] - bbox[0]
    total_w = logo_mind.width + 12 + text_w
    start_x = (im.width - total_w) // 2
    logo_y = 35
    text_y = logo_y + (logo_mind.height - (bbox[3] - bbox[1])) // 2 - 2
    im.paste(logo_mind, (start_x, logo_y), mask=logo_mind)
    draw.text((start_x + logo_mind.width + 12, text_y), 'BemTeVi', fill=(0, 66, 20), font=font_bold)

    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-mindfulness-educadores.jpg', quality=95)

    # 6. Cuidar de Quem Educa
    print("Patching infografico-cuidar-educador.jpg...")
    im = Image.open('public/flow-visuals/infografico-cuidar-educador.jpg').convert('RGB')
    bg_col = im.getpixel((680, 50))
    draw = ImageDraw.Draw(im)
    draw.rectangle([690, 20, 845, 125], fill=bg_col)

    logo_cuidar = logo_rgba.copy()
    logo_cuidar.thumbnail((68, 68), Image.Resampling.LANCZOS)
    im.paste(logo_cuidar, (740, 30), mask=logo_cuidar)

    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-cuidar-educador.jpg', quality=95)
    im.save('public/infografico_cuidar_educador.jpg', quality=95)

    # 7. Enfrentando o Estresse
    print("Patching infografico-estresse-lipp.jpg...")
    im = Image.open('public/flow-visuals/infografico-estresse-lipp.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-estresse-lipp.jpg', quality=95)
    im.save('public/infografico_estresse_lipp.jpg', quality=95)

    # 8. Rotina do Sono
    print("Patching infografico-sono-educador.jpg...")
    im = Image.open('public/flow-visuals/infografico-sono-educador.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-sono-educador.jpg', quality=95)

    # 9. Sono Mobile
    print("Patching infografico-sono-mobile.jpg...")
    im = Image.open('public/flow-visuals/infografico-sono-mobile.jpg').convert('RGB')
    footer, fh = get_scaled_footer(im.width)
    im.paste(footer, (0, im.height - fh))
    im.save('public/flow-visuals/infografico-sono-mobile.jpg', quality=95)

    print("All infographics patched successfully with authentic BemTeVi logos and footers!")

if __name__ == '__main__':
    patch_infographics()
