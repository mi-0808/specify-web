// YouTube Data API v3（公式 API）。videos.list は50件ごとに1ユニット
const API = "https://www.googleapis.com/youtube/v3"

export type Video = {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  thumbnail: string
  publishedAt: string
  embeddable: boolean
  isPublic: boolean
}

async function get(path: string, params: Record<string, string>) {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`YouTube ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

type ApiVideo = {
  id: string
  snippet: {
    title: string
    description: string
    channelId: string
    channelTitle: string
    publishedAt: string
    thumbnails: Record<string, { url: string }>
  }
  status: { embeddable: boolean; privacyStatus: string }
}

export async function getVideos(key: string, ids: string[]): Promise<Video[]> {
  const videos: Video[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const data = await get("videos", { part: "snippet,status", id: ids.slice(i, i + 50).join(","), key })
    for (const v of data.items as ApiVideo[]) {
      const t = v.snippet.thumbnails
      videos.push({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        thumbnail: (t.maxres ?? t.high ?? t.medium ?? t.default).url,
        publishedAt: v.snippet.publishedAt,
        embeddable: v.status.embeddable,
        isPublic: v.status.privacyStatus === "public",
      })
    }
  }
  return videos
}
