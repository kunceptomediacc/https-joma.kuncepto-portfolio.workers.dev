from pathlib import Path
import math
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
W, H, FPS, DURATION = 1920, 1080, 24, 30
OUT = ROOT / "output" / "joma-ai-prompt-specialist-30s.mp4"
BG, PANEL, INK, MUTED, YELLOW, ORANGE, CYAN = "#090b0d", "#12161b", "#f3f1eb", "#a8adb5", "#ffc400", "#ff4c2b", "#37b7e5"


def font(size, bold=False, mono=False):
    if mono:
        name = "consola.ttf"
    elif bold:
        name = "arialbd.ttf"
    else:
        name = "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


F_TITLE, F_H1, F_H2, F_BODY, F_SMALL, F_MONO = font(26, True), font(86, True), font(54, True), font(31), font(23), font(29, mono=True)


def cover(im, size):
    im = im.convert("RGB")
    scale = max(size[0] / im.width, size[1] / im.height)
    resized = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def contain(im, size):
    im = im.convert("RGBA")
    im.thumbnail(size, Image.Resampling.LANCZOS)
    return im


def ease(x):
    x = max(0, min(1, x))
    return x * x * (3 - 2 * x)


def phase(t, start, end):
    return ease((t - start) / (end - start))


def base():
    im = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((1250, -420, 2180, 510), fill=(255, 76, 43, 52))
    gd.ellipse((-420, 650, 500, 1570), fill=(55, 183, 229, 35))
    return Image.alpha_composite(im.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(120)))


def header(d, scene, label):
    d.text((86, 64), "KUNCEPTO / AI PROMPT SPECIALIST", font=F_TITLE, fill=YELLOW)
    d.text((1640, 68), f"{scene}  {label}", font=F_SMALL, fill=MUTED)
    d.line((86, 112, 1834, 112), fill="#2a2f36", width=2)


def wrap(d, text, f, max_width):
    words, lines, current = text.split(), [], ""
    for word in words:
        trial = (current + " " + word).strip()
        if d.textbbox((0, 0), trial, font=f)[2] <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_prompt(d, y, label, text, amount=1, accent=YELLOW):
    d.rounded_rectangle((86, y, 1160, y + 190), radius=20, fill=PANEL, outline="#30363e", width=2)
    d.text((120, y + 25), label.upper(), font=F_SMALL, fill=accent)
    shown = text[: max(0, int(len(text) * amount))]
    lines = wrap(d, shown, F_MONO, 970)
    for i, line in enumerate(lines[:3]):
        d.text((120, y + 70 + i * 43), line, font=F_MONO, fill=INK)
    if amount < 1:
        x = 120 + d.textbbox((0, 0), lines[-1] if lines else "", font=F_MONO)[2]
        d.rectangle((x + 4, y + 76 + (len(lines) - 1) * 43, x + 8, y + 109 + (len(lines) - 1) * 43), fill=accent)


def draw_codex_composer(d, y, text, amount=1, accent=YELLOW, sent=False):
    """Close-up Codex-style prompt composer with typewriter cursor."""
    d.rounded_rectangle((86, y, 1240, y + 250), radius=28, fill="#17191d", outline="#444850", width=2)
    d.text((126, y + 30), "CODEX", font=F_SMALL, fill=MUTED)
    shown = text[: max(0, int(len(text) * amount))]
    lines = wrap(d, shown, F_MONO, 1010)
    for i, line in enumerate(lines[:3]):
        d.text((126, y + 82 + i * 46), line, font=F_MONO, fill=INK)
    if amount < 1 and int(amount * 30) % 2 == 0:
        last = lines[-1] if lines else ""
        x = 126 + d.textbbox((0, 0), last, font=F_MONO)[2]
        d.rectangle((x + 5, y + 88 + (len(lines)-1)*46, x + 9, y + 124 + (len(lines)-1)*46), fill=accent)
    d.ellipse((116, y + 193, 154, y + 231), fill="#2b2e33")
    d.text((128, y + 198), "+", font=F_SMALL, fill=INK)
    send_fill = "#f3f1eb" if sent else "#34373c"
    d.ellipse((1165, y + 187, 1221, y + 243), fill=send_fill)
    d.text((1183, y + 199), "↑", font=F_TITLE, fill=BG if sent else MUTED)
    d.text((174, y + 201), "Ask Codex", font=F_SMALL, fill="#737981")


def scene_intro(t):
    im = base(); d = ImageDraw.Draw(im)
    p = phase(t, 0, 1.0)
    d.text((86, 64), "KUNCEPTO", font=F_TITLE, fill=YELLOW)
    d.text((86, 265 + int((1-p)*30)), "AI Prompt", font=F_H1, fill=INK)
    d.text((86, 360 + int((1-p)*30)), "Specialist", font=F_H1, fill=ORANGE)
    d.text((90, 495), "Turning clear instructions into workflows, visuals, and working code.", font=F_BODY, fill=MUTED)
    d.rounded_rectangle((90, 610, 660, 686), radius=12, fill=YELLOW)
    d.text((125, 629), "PROMPT  →  PLAN  →  PRODUCE", font=F_TITLE, fill=BG)
    return im


def scene_workflow_prompt(t):
    im = base(); d = ImageDraw.Draw(im); header(d, "01", "WORKFLOW")
    d.text((86, 165), "I start with the outcome.", font=F_H2, fill=INK)
    amount = phase(t, 3.2, 6.1)
    prompt = "Assist me in creating a workflow that analyzes a request, plans the steps, develops the output, and logs one normalized result."
    draw_codex_composer(d, 285, prompt, amount, YELLOW, t >= 6.0)
    a = phase(t, 6.0, 7.0)
    if a > 0:
        x = 1210
        d.rounded_rectangle((x, 285, 1834, 850), radius=20, fill="#0e1820", outline="#275468", width=2)
        d.text((x+34, 316), "AI RESPONSE", font=F_SMALL, fill=CYAN)
        steps = [("01", "Define webhook input"), ("02", "Route specialist agents"), ("03", "Normalize JSON output"), ("04", "Log + verify result")]
        for i, (n, text) in enumerate(steps):
            if phase(t, 6.3+i*.55, 6.8+i*.55) > 0:
                yy = 385+i*104
                d.rounded_rectangle((x+34, yy, x+590, yy+78), radius=12, fill="#151c22", outline="#2b3a44")
                d.text((x+56, yy+22), n, font=F_SMALL, fill=YELLOW)
                d.text((x+120, yy+20), text, font=F_BODY, fill=INK)
    d.text((86, 935), "Prompt skill: scope the goal • name the output • define acceptance criteria", font=F_SMALL, fill=MUTED)
    return im


def scene_n8n(t, workflows):
    im = base(); d = ImageDraw.Draw(im); header(d, "01", "RESULT")
    d.text((86, 155), "The plan becomes a working n8n system.", font=F_H2, fill=INK)
    positions = [(86,275),(970,275),(86,625),(970,625)]
    labels = ["ORCHESTRATOR","ANALYZER","PLANNER","DEVELOPER"]
    for i, (src, pos, label) in enumerate(zip(workflows, positions, labels)):
        thumb = cover(src, (790, 285)); im.paste(thumb, pos)
        d.rectangle((pos[0], pos[1]+232, pos[0]+790, pos[1]+285), fill=(0,0,0,190))
        d.text((pos[0]+22, pos[1]+246), f"0{i+1} · {label}", font=F_SMALL, fill=YELLOW)
    return im


def scene_print_prompt(t):
    im = base(); d = ImageDraw.Draw(im); header(d, "02", "PRINT DESIGN")
    d.text((86, 165), "Then I shape the visual brief.", font=F_H2, fill=INK)
    prompt = "Create a vibrant alien illustration for a printable shirt design. Use neon green, purple, and cyan on black. Keep the silhouette bold and production-friendly."
    draw_codex_composer(d, 285, prompt, phase(t, 15.2, 18.2), ORANGE, t >= 18.2)
    tags = ["Subject", "Palette", "Medium", "Print constraints"]
    for i, tag in enumerate(tags):
        x=86+i*300
        d.rounded_rectangle((x, 575, x+270, 650), radius=12, fill=PANEL, outline="#343941")
        d.text((x+24,596), tag, font=F_SMALL, fill=INK)
    d.text((86, 805), "A strong prompt is a production brief—not just a sentence.", font=F_H2, fill=YELLOW)
    return im


def scene_alien(t, alien):
    im = base(); d=ImageDraw.Draw(im); header(d, "02", "VISUAL OUTPUT")
    p=phase(t,19,20)
    art=contain(alien,(1080,850)); art=art.resize((max(1,int(art.width*(.94+.06*p))),max(1,int(art.height*(.94+.06*p)))),Image.Resampling.LANCZOS)
    im.alpha_composite(art,(760+(1080-art.width)//2,145+(850-art.height)//2))
    d.text((86,205), "Prompted for", font=F_TITLE, fill=MUTED)
    d.text((86,255), "print.", font=F_H1, fill=ORANGE)
    d.text((86,365), "Directed with", font=F_TITLE, fill=MUTED)
    d.text((86,415), "design sense.", font=F_H2, fill=INK)
    d.text((86,590), "My alien artwork becomes the example:", font=F_BODY, fill=INK)
    for i,s in enumerate(["clear subject","controlled palette","usable composition","production intent"]):
        d.text((110,650+i*55), "• "+s, font=F_BODY, fill=YELLOW if i==3 else MUTED)
    return im


def scene_code(t, code):
    im=base(); d=ImageDraw.Draw(im); header(d,"03","CODING")
    d.text((86,155),"I prompt, inspect, test, and improve.",font=F_H2,fill=INK)
    prompt="Help me debug and improve this local AI agent wrapper. Preserve the JSON contract and explain every change."
    draw_codex_composer(d,245,prompt,phase(t,23.0,24.35),CYAN,t>=24.35)
    panel=cover(code,(1160,652)); im.paste(panel,(674,330))
    d.text((86,545),"Codex assists with:",font=F_TITLE,fill=YELLOW)
    for i,s in enumerate(["code inspection","debugging","documentation","iteration"]):
        d.text((110,605+i*56),"→  "+s,font=F_BODY,fill=INK)
    return im


def scene_outro(t, alien):
    im=base(); d=ImageDraw.Draw(im)
    art=contain(alien,(660,740)); im.alpha_composite(art,(1180,160))
    d.text((86,120),"JOMA ECHAVEZ",font=F_TITLE,fill=YELLOW)
    d.text((86,250),"AI Prompt",font=F_H1,fill=INK)
    d.text((86,345),"Specialist",font=F_H1,fill=ORANGE)
    d.text((90,490),"Workflows  •  Visuals  •  Coding",font=F_BODY,fill=MUTED)
    d.rounded_rectangle((90,620,1040,715),radius=14,fill=YELLOW)
    d.text((132,647),"joma.kuncepto-portfolio.workers.dev",font=F_MONO,fill=BG)
    d.text((90,790),"Clear prompts. Practical outputs. Human judgment.",font=F_H2,fill=INK)
    return im


def cursor(d, x, y, pulse=0):
    if pulse > 0:
        r = int(18 + 34 * pulse)
        d.ellipse((x-r, y-r, x+r, y+r), outline=(255,76,43,max(20,int(190*(1-pulse)))), width=5)
    d.polygon([(x,y),(x+10,y+28),(x+18,y+18),(x+31,y+23)], fill="#ffffff", outline="#111111")


def codex_shell(title, prompt_text="", typed=1, response=None, artifact=None, artifact_label="PREVIEW", cursor_pos=None, pulse=0, zoom=1):
    canvas=Image.new("RGBA",(W,H),"#aaa7ee")
    shadow=Image.new("RGBA",(W,H),(0,0,0,0)); sd=ImageDraw.Draw(shadow)
    sd.rounded_rectangle((86,58,1834,1032),radius=30,fill=(0,0,0,115)); shadow=shadow.filter(ImageFilter.GaussianBlur(28)); canvas=Image.alpha_composite(canvas,shadow)
    app=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(app)
    d.rounded_rectangle((70,42,1820,1018),radius=26,fill="#0f1013",outline="#383a40",width=2)
    # Title bar and navigation
    d.rounded_rectangle((70,42,1820,108),radius=26,fill="#17181c")
    for i,c in enumerate(["#ff5f57","#febc2e","#28c840"]): d.ellipse((98+i*30,66,114+i*30,82),fill=c)
    d.text((178,63),"CODEX",font=F_TITLE,fill=INK); d.text((310,66),title,font=F_SMALL,fill=MUTED)
    d.rectangle((70,108,350,1018),fill="#141519"); d.line((350,108,350,1018),fill="#2c2e34",width=2)
    d.text((104,140),"TASKS",font=F_SMALL,fill="#777d86")
    tasks=["Kuncepto portfolio","Local AI agents","Prompt specialist video"]
    for i,s in enumerate(tasks):
        yy=190+i*64
        if i==2: d.rounded_rectangle((92,yy-12,330,yy+40),radius=10,fill="#24262c")
        d.text((112,yy),s,font=F_SMALL,fill=INK if i==2 else MUTED)
    d.text((106,908),"LOCAL WORKSPACE",font=F_SMALL,fill="#777d86"); d.text((106,950),"Kuncepto",font=F_SMALL,fill=INK)
    # Conversation and artifact panel
    split=1220 if artifact is not None else 1788
    if artifact is not None:
        d.line((1220,108,1220,1018),fill="#2c2e34",width=2); d.text((1260,137),artifact_label,font=F_SMALL,fill=YELLOW)
    sent = response is not None or artifact is not None
    shown=prompt_text[:max(0,int(len(prompt_text)*typed))]
    y=150
    if sent:
        d.text((400,y),"Joma",font=F_SMALL,fill=YELLOW); y=200
        for line in wrap(d,prompt_text,F_BODY,750): d.text((400,y),line,font=F_BODY,fill=INK); y+=44
    if response:
        y=max(340,y+55); d.text((400,y),"Codex",font=F_SMALL,fill=CYAN); y+=52
        for i,line in enumerate(response):
            d.rounded_rectangle((400,y,1158,y+58),radius=10,fill="#181b20",outline="#30343b")
            d.text((420,y+15),"✓",font=F_SMALL,fill="#55d98a"); d.text((466,y+13),line,font=F_SMALL,fill=INK); y+=72
    # Composer stays visible like the real working surface
    cy=806; right=1166 if artifact is not None else 1734
    d.rounded_rectangle((390,cy,right,960),radius=22,fill="#1d1f24",outline="#4a4d54",width=2)
    if not sent:
        lines=wrap(d,shown,F_SMALL,right-474)
        for i,line in enumerate(lines[:3]): d.text((424,830+i*33),line,font=F_SMALL,fill=INK)
        if typed<1 and int(typed*36)%2==0:
            last=lines[-1] if lines else ""; xx=424+d.textbbox((0,0),last,font=F_SMALL)[2]
            d.rectangle((xx+4,836+(len(lines)-1)*33,xx+8,861+(len(lines)-1)*33),fill=YELLOW)
    else:
        d.text((424,836),"Ask Codex",font=F_SMALL,fill="#7c8189")
    d.text((424,908),"+",font=F_TITLE,fill=MUTED); d.ellipse((right-68,884,right-20,932),fill="#f3f1eb"); d.text((right-53,893),"↑",font=F_TITLE,fill=BG)
    if artifact is not None:
        box=(1250,185,1788,950); art=cover(artifact,(box[2]-box[0],box[3]-box[1])); app.paste(art,(box[0],box[1])); d.rounded_rectangle(box,radius=12,outline="#3e4249",width=2)
    if cursor_pos: cursor(d,*cursor_pos,pulse)
    if zoom!=1:
        crop_w=int(W/zoom); crop_h=int(H/zoom); cx,cyy=cursor_pos or (W//2,H//2)
        left=max(0,min(W-crop_w,cx-crop_w//2)); top=max(0,min(H-crop_h,cyy-crop_h//2))
        app=app.crop((left,top,left+crop_w,top+crop_h)).resize((W,H),Image.Resampling.LANCZOS)
    return Image.alpha_composite(canvas,app)


def ui_intro(t):
    p=phase(t,0,1.2); im=codex_shell("AI Prompt Specialist")
    if p<1:
        bg=Image.new("RGBA",(W,H),"#aaa7ee"); scaled=im.resize((int(W*(.84+.16*p)),int(H*(.84+.16*p))),Image.Resampling.LANCZOS); bg.alpha_composite(scaled,((W-scaled.width)//2,(H-scaled.height)//2)); im=bg
    return im


def ui_workflow(t):
    prompt="Assist me in creating a multi-agent workflow that analyzes a request, plans the work, develops the output, and logs one normalized result."
    typed=phase(t,2.0,5.0); sent=t>=5.0; response=None
    if t>=5.2: response=["Define webhook input and output contract","Route Analyzer → Planner → Developer","Normalize JSON and log the result"]
    pos=(1122,912) if sent else (700+int(400*typed),520+int(390*typed)); pulse=max(0,1-abs(t-5.1)/.45) if sent else 0
    return codex_shell("Local AI workflow",prompt,typed,response,None,cursor_pos=pos,pulse=pulse,zoom=1+.08*phase(t,2,3))


def ui_workflow_result(t,workflows):
    idx=min(3,int((t-8.2)/.85)); art=workflows[max(0,idx)]
    p=(t-8)%1; pos=(1450,470); return codex_shell("Local AI workflow","Workflow created and tested.",1,["Four connected agents","One normalized output"],art,f"N8N · {['ORCHESTRATOR','ANALYZER','PLANNER','DEVELOPER'][max(0,idx)]}",pos,max(0,1-abs(p-.45)/.3),1+.12*phase(t,8,9))


def ui_print(t,alien):
    prompt="Use my alien artwork to create a bold print-design presentation. Keep the neon palette, strong silhouette, and production-ready composition."
    typed=phase(t,12.0,15.0); response=["Preserve original alien artwork","Frame for print presentation","Check contrast and production intent"] if t>=15.1 else None
    show=alien if t>=15.1 else None; pulse=max(0,1-abs(t-15.05)/.42)
    return codex_shell("Print design prompt",prompt,typed,response,show,"ALIEN PRINT DESIGN" if show else "PREVIEW",(1122,912),pulse,1+.10*phase(t,12,13))


def ui_code(t,code):
    prompt="Inspect this local AI agent wrapper. Improve error handling, preserve the JSON contract, and explain each code change."
    typed=phase(t,18.0,20.8); response=["Validated request payload","Preserved response schema","Documented safe improvements"] if t>=21 else None
    show=code if t>=20.9 else None; pulse=max(0,1-abs(t-20.9)/.42)
    return codex_shell("Coding with Codex",prompt,typed,response,show,"CODE DIFF" if show else "PREVIEW",(1122,912),pulse,1+.12*phase(t,18,19))


def ui_outro(t,alien):
    im=codex_shell("AI Prompt Specialist","Clear prompts. Practical outputs. Human judgment.",1,["Workflow automation","Print design direction","Coding and debugging"],alien,"JOMA'S WORK")
    veil=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(veil); a=int(210*phase(t,27,28)); d.rectangle((70,42,1820,1018),fill=(9,11,13,a));
    if t>=28:
        d.text((400,360),"AI PROMPT SPECIALIST",font=F_H1,fill=INK); d.text((405,475),"Joma Echavez · Kuncepto",font=F_H2,fill=YELLOW); d.text((405,575),"joma.kuncepto-portfolio.workers.dev",font=F_BODY,fill=INK)
    return Image.alpha_composite(im,veil)


def crossfade(a,b,p):
    return Image.blend(a.convert("RGB"),b.convert("RGB"),ease(p))


def main():
    ffmpeg=str(ROOT / "video-tools" / "imageio_ffmpeg" / "binaries" / "ffmpeg-win-x86_64-v7.1.exe")
    alien=Image.open(ROOT/"video-assets"/"alien-designer.png")
    code=Image.open(ROOT/"assets"/"portfolio"/"codex-agent-code.webp")
    workflows=[Image.open(ROOT/"assets"/"portfolio"/n) for n in ["n8n-orchestrator.webp","n8n-analyzer.webp","n8n-planner.webp","n8n-developer.webp"]]
    OUT.parent.mkdir(exist_ok=True)
    cmd=[ffmpeg,"-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",str(OUT)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    timeline=[
        (0,2,lambda x:ui_intro(x)),
        (2,8,lambda x:ui_workflow(x)),
        (8,12,lambda x:ui_workflow_result(x,workflows)),
        (12,18,lambda x:ui_print(x,alien)),
        (18,25,lambda x:ui_code(x,code)),
        (25,30,lambda x:ui_outro(x,alien)),
    ]
    transition=.38
    for frame in range(DURATION*FPS):
        t=frame/FPS
        idx=next(i for i,(start,end,fn) in enumerate(timeline) if start <= t < end)
        start,end,fn=timeline[idx]
        im=fn(t)
        if idx>0 and t < start+transition:
            previous=timeline[idx-1][2](start-.001)
            # A soft horizontal push accompanies each crossfade.
            p=phase(t,start,start+transition)
            shift=int(70*(1-p))
            current=Image.new("RGB",(W,H),BG); current.paste(im.convert("RGB"),(shift,0))
            old=Image.new("RGB",(W,H),BG); old.paste(previous.convert("RGB"),(-int(45*p),0))
            im=crossfade(old,current,p)
        proc.stdin.write(im.convert("RGB").tobytes())
    proc.stdin.close()
    code_out=proc.wait()
    if code_out: raise SystemExit(code_out)
    print(OUT)


if __name__ == "__main__":
    main()
