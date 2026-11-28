#!/usr/bin/env bash
# 운명비서 시험용 임시 미디어 만들기 (디자인 실장, 2026-11-28)
#   bash design/unmyeong/tools/make-placeholder-media.sh
# 결과: public/unmyeong/placeholder/
#   intro_{pc_16x9,mobile_9x16}.{mp4,webm}          8.0초  어둠 → 등불 → 납품 탑뷰 정지 이미지(마지막 1초 정지)
#   result_entry_{pc_16x9,mobile_9x16}.{mp4,webm}  12.0초 떠오름 0~6 / 책장 루프 6~9(6초=9초 프레임) / 멈춤 9~12
#   *_poster.jpg                                    각 영상 첫 프레임
#   sfx_brush_close.mp3                             약 1.2초 마른 붓 스침(노이즈 합성 — 직접 생성, 저작권 없음)
# 원본: public/unmyeong/final/book_topview_{pc_16x9,mobile_9x16}.jpg (대표 납품 정지 이미지)
# 임시다. 실제 영상이 오면 public/unmyeong/final/에 같은 이름으로 두고 자산 목록 경로만 바꾼다(DESIGN_SYSTEM 8-9).
# 규칙(DESIGN_SYSTEM 8-9): H.264 yuv420p faststart, 오디오 트랙 없음, 영상마다 2MB 이하(넘으면 CRF를 올려 다시 — 그래도 넘으면 실패).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SRC="$ROOT/public/unmyeong/final"
OUT="$ROOT/public/unmyeong/placeholder"
FF="${FFMPEG:-/usr/bin/ffmpeg}"
FONT="${FONT:-/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc}"   # 디버그 글자용(한글 가능한 아무 글꼴)
LIMIT=$((2 * 1024 * 1024))
FPS=30
# 정지 이미지(1920×1072, 1080×1936)를 영상 틀(1920×1080, 1080×1920)에 넣는 방법
#   pad  = 긴 쪽을 틀에 맞추고 남는 몇 px를 가장자리 늘이기로 채움(기본 — 8-9 설명: 흔한 화면 비율에서 cover 결과가 정지 이미지와 픽셀 단위로 일치)
#   crop = cover(가운데 자르기)
PC_FIT="${PC_FIT:-pad}"
MOBILE_FIT="${MOBILE_FIT:-pad}"
# 결과 진입 영상 구간(초) — src/lib/unmyeong/assets.ts media 항목과 같아야 한다
RE_TOTAL=12
RE_LOOP_IN=6
RE_LOOP_OUT=9

[ -x "$FF" ] || { echo "ffmpeg 없음: $FF" >&2; exit 1; }
[ -f "$FONT" ] || { echo "글꼴 없음: $FONT (FONT=경로 로 지정)" >&2; exit 1; }
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
q() { "$FF" -hide_banner -loglevel error -y "$@"; }

# ── 1. 정지 이미지 → 영상 해상도 프레임 ─────────────────────────────
make_frame() { # 이름 원본 W H 방식
  local name=$1 src=$2 W=$3 H=$4 fit=$5 sw sh vf
  read -r sw sh < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$src" | tr x ' ')
  if [ "$fit" = crop ]; then
    vf="scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}"
  else
    # 긴 쪽(틀에 대해 덜 남는 쪽)을 맞추고 짝수 크기로, 남는 칸은 가장자리 픽셀 늘이기
    local fw fh px py
    if [ $((sw * H)) -ge $((sh * W)) ]; then fw=$W; fh=$(( (sh * W / sw + 1) / 2 * 2 )); else fh=$H; fw=$(( (sw * H / sh + 1) / 2 * 2 )); fi
    px=$(( (W - fw) / 2 )); py=$(( (H - fh) / 2 ))
    vf="scale=${fw}:${fh}:flags=lanczos,pad=${W}:${H}:${px}:${py},fillborders=left=${px}:right=$((W - fw - px)):top=${py}:bottom=$((H - fh - py)):mode=smear"
    echo "$name: ${sw}x${sh} -> ${fw}x${fh} + 여백 좌우 ${px} 위아래 ${py}" >&2
  fi
  q -i "$src" -vf "$vf,format=rgb24" -frames:v 1 "$TMP/${name}_frame.png"
  # 결과 진입 영상 확대용 2배 원본(확대 떨림 줄이기)
  q -i "$TMP/${name}_frame.png" -vf "scale=$((W * 2)):$((H * 2)):flags=lanczos" -frames:v 1 "$TMP/${name}_frame2x.png"
}

# 등불 빛 마스크(왼쪽 위 등불에서 번지는 둥근 밝기) — 한 장만 계산
make_lamp() { # 이름 W H cx cy R 지수 바닥
  local name=$1 W=$2 H=$3 cx=$4 cy=$5 R=$6 g=$7 fl=$8 tag=$9
  q -f lavfi -i "color=c=white:s=${W}x${H}:d=1" -vf "format=gray,geq=lum='255*(${fl}+(1-${fl})*pow(clip(1-hypot(X-${cx}*W,Y-${cy}*H)/(max(W,H)*${R}),0,1),${g}))',format=gbrp" -frames:v 1 "$TMP/${name}_mask_${tag}.png"
  q -i "$TMP/${name}_frame.png" -i "$TMP/${name}_mask_${tag}.png" -filter_complex "[0]format=gbrp[a];[1]format=gbrp[b];[a][b]blend=all_mode=multiply,format=rgb24" -frames:v 1 "$TMP/${name}_lit_${tag}.png"
}

# ── 인코딩(크기 넘으면 CRF 올림) ─────────────────────────────────────
encode_mp4() { # 입력 출력
  local crf
  for crf in 24 27 30 33 36; do
    q -i "$1" -an -c:v libx264 -preset slow -crf $crf -pix_fmt yuv420p -profile:v high -level 4.1 \
      -r $FPS -g $FPS -keyint_min $FPS -sc_threshold 0 -movflags +faststart "$2"
    [ "$(stat -c %s "$2")" -le $LIMIT ] && { echo "  $(basename "$2") crf=$crf $(stat -c %s "$2")B" >&2; return 0; }
  done
  echo "2MB 초과: $2" >&2; exit 1
}
encode_webm() {
  local crf
  for crf in 36 40 44 48; do
    q -i "$1" -an -c:v libvpx-vp9 -b:v 0 -crf $crf -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p \
      -r $FPS -g $FPS "$2"
    [ "$(stat -c %s "$2")" -le $LIMIT ] && { echo "  $(basename "$2") crf=$crf $(stat -c %s "$2")B" >&2; return 0; }
  done
  echo "2MB 초과: $2" >&2; exit 1
}
poster() { q -i "$1" -frames:v 1 -q:v 7 "$2"; }

label_args() { # W 글자크기 왼쪽여백 위여백 → drawtext 문자열(임시 영상)
  printf "drawtext=fontfile='%s':text='임시 영상':fontsize=%s:fontcolor=0xE2D8C5@0.85:box=1:boxcolor=0x141310@0.55:boxborderw=10:x=%s:y=%s" "$FONT" "$2" "$3" "$4"
}

# ── 2. 인트로 8초 ────────────────────────────────────────────────────
# 0~1 검은 화면 / 1~3 작은 등불 빛이 어둠에서 켜짐(흔들림) / 3~4.5 빛이 방 전체로 번짐
# / 5.5~7 정지 이미지로 페이드 / 7~8 정지 이미지 그대로(글자도 없음 → 정지 이미지와 같은 프레임)
make_intro() { # 이름 W H 글자크기 여백x 여백y
  local name=$1 W=$2 H=$3 fs=$4 mx=$5 my=$6
  local flick="eq=eval=frame:brightness='0.012*sin(2*PI*1.3*t)+0.008*sin(2*PI*3.7*t+1)'"
  q -loop 1 -framerate $FPS -t 4.5 -i "$TMP/${name}_lit_tight.png" \
    -loop 1 -framerate $FPS -t 4.0 -i "$TMP/${name}_lit_wide.png" \
    -loop 1 -framerate $FPS -t 2.5 -i "$TMP/${name}_frame.png" \
    -filter_complex "[0]format=yuv420p,$flick,fade=t=in:st=1:d=2,settb=AVTB[a];[1]format=yuv420p,$flick,settb=AVTB[b];[2]format=yuv420p,settb=AVTB[c];[a][b]xfade=transition=fade:duration=1.5:offset=3.0[ab];[ab][c]xfade=transition=fade:duration=1.5:offset=5.5,$(label_args "$W" "$fs" "$mx" "$my"):enable='lt(t,7)'[v]" \
    -map "[v]" -frames:v $((8 * FPS)) -c:v libx264 -qp 0 -preset ultrafast -pix_fmt yuv420p "$TMP/intro_${name}.mkv"
  encode_mp4 "$TMP/intro_${name}.mkv" "$OUT/intro_${name}.mp4"
  encode_webm "$TMP/intro_${name}.mkv" "$OUT/intro_${name}.webm"
  poster "$OUT/intro_${name}.mp4" "$OUT/intro_${name}_poster.jpg"
}

# ── 3. 결과 진입 12초 ────────────────────────────────────────────────
# 0~6 떠오름: 1.00→1.06 확대(부드럽게), 살짝 이동, 밝기 0.86→1.00
# 6~9 책장 넘김 루프: 확대·밝기 고정, 그림자 띠가 책장을 두 번 가로지름(6.0·7.5·9.0초엔 띠 없음 → 6초=9초 프레임)
# 9~10.6 마지막 한 장이 느려지며 멈춤(띠가 끝까지 가지 않고 사라짐) + 1.06→1.055 눌러 앉음(~11초)
# 11~12 완전 정지(마지막 프레임 고정)
# 오른쪽 아래 디버그: 구간 이름 + t(0.1초) + 프레임 번호
make_entry() { # 이름 W H 글자크기 여백x 여백y DX DY 쓸기축(u|v) 쓸기a b 가로c d 띠폭 그림자세기
  local name=$1 W=$2 H=$3 fs=$4 mx=$5 my=$6 DX=$7 DY=$8 ax=$9 a=${10} b=${11} c=${12} d=${13} sig=${14} A=${15}
  local E="if(lt(on,180),(on/180)*(on/180)*(3-2*on/180),1)"
  local Z="if(lt(on/30,6),1+0.06*(on/180)*(on/180)*(3-2*on/180),if(lt(on/30,9),1.06,if(lt(on/30,11),1.06-0.005*(1-pow(1-(on/30-9)/2,2)),1.055)))"
  local LW=$((W / 4)) LH=$((H / 4))
  local s r
  if [ "$ax" = u ]; then s="(X/W)"; r="(Y/H)"; else s="(Y/H)"; r="(X/W)"; fi
  local P="if(between(T,6,7.5),(T-6)/1.5,if(between(T,7.5,9),(T-7.5)/1.5,if(between(T,9,10.6),0.8*(1-pow(1-(T-9)/1.6,2)),0)))"
  local PE="(($P)*($P)*(3-2*($P)))"
  local ENV="if(between(T,6,9),sin(PI*($P)),if(between(T,9,10.6),0.8*sin(PI*(T-9)/1.6),0))"
  local POS="($a+($b-$a)*if(between(T,9,10.6),$P,$PE))"
  local IN="clip(($r-$c)/0.01,0,1)*clip(($d-$r)/0.01,0,1)*clip(($s-$a)/0.01,0,1)*clip(($b-$s)/0.01,0,1)"
  local BR="if(lt(T,6),0.86+0.14*(T/6)*(T/6)*(3-2*T/6),1)"
  local SH="floor(255*$BR*(1-$A*exp(-pow(($s-$POS)/$sig,2))*$IN*$ENV)+0.5)"
  printf 'A 떠오름 0–6s' >"$TMP/seg_a.txt"; printf 'B 책장 루프 6–9s' >"$TMP/seg_b.txt"; printf 'C 멈춤 9–12s' >"$TMP/seg_c.txt"
  printf 't=%%{eif:floor(t):d}.%%{eif:mod(floor(t*10),10):d}s  f=%%{n}' >"$TMP/tc.txt"
  local dt="fontfile='$FONT':fontsize=$fs:fontcolor=0xE2D8C5@0.9:box=1:boxcolor=0x141310@0.6:boxborderw=8"
  local seg="drawtext=$dt:textfile='$TMP/seg_a.txt':x=w-tw-$mx:y=h-$my-2.6*$fs:enable='lt(t,6)',drawtext=$dt:textfile='$TMP/seg_b.txt':x=w-tw-$mx:y=h-$my-2.6*$fs:enable='gte(t,6)*lt(t,9)',drawtext=$dt:textfile='$TMP/seg_c.txt':x=w-tw-$mx:y=h-$my-2.6*$fs:enable='gte(t,9)',drawtext=$dt:textfile='$TMP/tc.txt':x=w-tw-$mx:y=h-$my-th"
  q -loop 1 -framerate $FPS -t $RE_TOTAL -i "$TMP/${name}_frame2x.png" \
    -f lavfi -i "color=c=white:s=${LW}x${LH}:r=$FPS:d=$RE_TOTAL" \
    -filter_complex "[0]zoompan=z='$Z':x='(iw-iw/zoom)*(0.5+$DX*$E)':y='(ih-ih/zoom)*(0.5+$DY*$E)':d=1:s=${W}x${H}:fps=$FPS,format=gbrp,settb=AVTB[z];[1]format=gray,geq=lum='$SH',scale=${W}:${H}:flags=bicubic,format=gbrp,settb=AVTB[s];[z][s]blend=all_mode=multiply,format=yuv420p,$(label_args "$W" "$fs" "$mx" "$my"),$seg[v]" \
    -map "[v]" -frames:v $((RE_TOTAL * FPS)) -c:v libx264 -qp 0 -preset ultrafast -pix_fmt yuv420p "$TMP/entry_${name}.mkv"
  encode_mp4 "$TMP/entry_${name}.mkv" "$OUT/result_entry_${name}.mp4"
  encode_webm "$TMP/entry_${name}.mkv" "$OUT/result_entry_${name}.webm"
  poster "$OUT/result_entry_${name}.mp4" "$OUT/result_entry_${name}_poster.jpg"
}

# 책장 영역(영상 틀 기준 0~1)을 6~9초 확대 상태(z=1.06, 이동 반영)로 옮김
to_out() { # 값 기준이동비율 → (v-(1-1/z)*f)*z
  awk -v v="$1" -v f="$2" 'BEGIN{z=1.06; printf "%.4f", (v-(1-1/z)*f)*z}'
}

# ── 실행 ─────────────────────────────────────────────────────────────
make_frame pc_16x9 "$SRC/book_topview_pc_16x9.jpg" 1920 1080 "$PC_FIT"
make_frame mobile_9x16 "$SRC/book_topview_mobile_9x16.jpg" 1080 1920 "$MOBILE_FIT"
# 등불 위치(정지 이미지 실측): PC 왼쪽 등불 (5%,31%), 모바일 왼쪽 위 (2%,8%)
make_lamp pc_16x9 1920 1080 0.05 0.31 0.38 1.8 0.0 tight
make_lamp pc_16x9 1920 1080 0.05 0.31 1.15 1.1 0.22 wide
make_lamp mobile_9x16 1080 1920 0.02 0.08 0.40 1.8 0.0 tight
make_lamp mobile_9x16 1080 1920 0.02 0.08 1.20 1.1 0.22 wide

# 글자 위치: cover로 잘려도 보이게 안쪽 여백(PC 위아래 잘림·모바일 좌우 잘림 고려)
make_intro pc_16x9 1920 1080 30 150 150
make_intro mobile_9x16 1080 1920 40 150 130

# 책장 영역(22번 문서 실측 %, 영상 틀 기준으로 환산). PC: 두 쪽 전체 x 26~73.5%, y 22~81% / 모바일: x 13~89%, y 22~80%
if [ "$PC_FIT" = pad ]; then pv1=$(awk 'BEGIN{printf "%.4f",(4+0.22*1072)/1080}'); pv2=$(awk 'BEGIN{printf "%.4f",(4+0.81*1072)/1080}'); else pv1=0.2229; pv2=0.8137; fi
if [ "$MOBILE_FIT" = pad ]; then mu1=$(awk 'BEGIN{printf "%.4f",(4+0.13*1072)/1080}'); mu2=$(awk 'BEGIN{printf "%.4f",(4+0.89*1072)/1080}'); mv1=0.22; mv2=0.80
else mu1=0.13; mu2=0.89; mv1=$(awk 'BEGIN{printf "%.4f",(0.22*1936-8)/1920}'); mv2=$(awk 'BEGIN{printf "%.4f",(0.80*1936-8)/1920}'); fi
# PC: 오른쪽 위로 살짝(DX +0.15, DY -0.1), 띠는 왼쪽→오른쪽 / 모바일: 위로 살짝(DX 0, DY -0.12), 띠는 위→아래(가로 접힘)
make_entry pc_16x9 1920 1080 26 150 150 0.15 -0.10 u \
  "$(to_out 0.26 0.65)" "$(to_out 0.735 0.65)" "$(to_out "$pv1" 0.40)" "$(to_out "$pv2" 0.40)" 0.045 0.42
make_entry mobile_9x16 1080 1920 34 150 170 0.0 -0.12 v \
  "$(to_out "$mv1" 0.38)" "$(to_out "$mv2" 0.38)" "$(to_out "$mu1" 0.5)" "$(to_out "$mu2" 0.5)" 0.035 0.42

# ── 4. 효과음: 마른 붓 스침 약 1.2초 ─────────────────────────────────
# 분홍 잡음(종이 결) + 갈색 잡음(낮은 쓸림), 대역 제한 + 빠른 떨림(붓털) + 짧은 시작·긴 꼬리, 작은 볼륨(최대 약 -15dBFS)
q -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=1.2:amplitude=0.8:seed=11" \
  -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=1.2:amplitude=0.6:seed=5" \
  -filter_complex "[0]highpass=f=1600,lowpass=f=6500,tremolo=f=27:d=0.35[h];[1]highpass=f=180,lowpass=f=900,volume=0.5[l];[h][l]amix=inputs=2:normalize=0,afade=t=in:d=0.08:curve=qsin,afade=t=out:st=0.3:d=0.9:curve=exp,volume=-6dB,alimiter=limit=0.18:level=false,aformat=channel_layouts=mono" \
  -c:a libmp3lame -b:a 96k "$OUT/sfx_brush_close.mp3"

echo "완료: $OUT" >&2
