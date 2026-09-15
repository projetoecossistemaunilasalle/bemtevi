import subprocess, os

ffmpeg = r"C:\Users\Vitor\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"

images = [
    ("public/flow-visuals/infografico-cuidar-educador.jpg", "public/flow-visuals/opt-cuidar-educador.png"),
    ("public/flow-visuals/infografico-manejo-emocoes.jpg", "public/flow-visuals/opt-manejo-emocoes.png"),
    ("public/flow-visuals/infografico-mindfulness-educadores.jpg", "public/flow-visuals/opt-mindfulness.png"),
    ("public/flow-visuals/infografico-estresse-lipp.jpg", "public/flow-visuals/opt-estresse.png"),
    ("public/flow-visuals/infografico-mitos-fatos.jpg", "public/flow-visuals/opt-mitos-fatos.png"),
    ("public/flow-visuals/infografico-resiliencia-ativa.jpg", "public/flow-visuals/opt-resiliencia.png"),
    ("public/flow-visuals/infografico-sono-educador.jpg", "public/flow-visuals/opt-sono.png"),
]

total_size = 0
for src, dst in images:
    vf = "scale=560:-1,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse"
    cmd = [ffmpeg, "-y", "-i", src, "-vf", vf, dst]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    size = os.path.getsize(dst)
    total_size += size
    print(f"{dst}: {size} bytes ({size/1024:.1f} KB)")

print(f"Total size: {total_size} bytes ({total_size/1024/1024:.2f} MB)")
