# Electron Build Assets

이 디렉토리는 electron-builder 가 빌드 시 참조하는 정적 자산을 둔다.

## 필요한 파일 (실제 빌드 전 추가 필요)

| 파일 | 용도 | 권장 사이즈 |
|---|---|---|
| `icon.icns` | macOS 앱 아이콘 | 1024×1024 PNG → ICNS 변환 |
| `icon.ico` | Windows 앱 아이콘 | 256×256 ICO |
| `icon.png` | Linux 앱 아이콘 | 512×512 PNG |
| `entitlements.mac.plist` | macOS 코드사이닝 entitlements (선택) | XML |

## 자동 생성 도구

1024×1024 PNG 한 장만 있으면 자동으로 모든 포맷 생성 가능:

```bash
# electron-icon-builder 또는 icon-genie
npx electron-icon-builder --input=./source-icon.png --output=./build
```

또는 Mac 의 경우 수동으로:

```bash
# PNG → ICNS (Mac 기본 도구 사용)
mkdir icon.iconset
sips -z 16 16   source-icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32   source-icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32   source-icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64   source-icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 source-icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 source-icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 source-icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 source-icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 source-icon.png --out icon.iconset/icon_512x512.png
cp source-icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

## 현재 상태

icon 파일들이 없으면 electron-builder 가 default Electron 아이콘 사용 (회색 톱니).
첫 베타 출시 전 실제 아이콘 디자인 + 위 파일들 추가 필요.

## Source 후보

`packages/web/public/icon.svg` 와 `icon-dark.svg` 가 PowerBalance 의 기존 SVG 로고.
이를 1024×1024 PNG 로 export 후 위 파일들 생성.
