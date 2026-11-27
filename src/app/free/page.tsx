import { FreeClient } from "./free-client"
import { freeMetadata } from "./_lib/metadata"

// 검색·공유 유입용 메타데이터(정적). 일간별 공유 링크는 /free/dm/[stem] 에서 같은 화면에 일간 이미지만 바꿔 쓴다.
export const metadata = freeMetadata()

export default function FreePage() {
  return <FreeClient />
}
