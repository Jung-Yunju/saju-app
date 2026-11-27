// 빌드 시점에 content/free/*.json을 읽어 표준 출력으로 내보낸다(미리보기 묶음에 넣기 위함).
import { loadRawContent } from "@/app/free/_lib/content"
process.stdout.write(JSON.stringify(loadRawContent()))
