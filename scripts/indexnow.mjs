/**
 * IndexNow: tell Bing, Yandex and Seznam that the pages changed, the moment they change.
 * Google ignores it, which is what the sitemap is for. Runs after a deploy, reads the
 * addresses out of the sitemap we just built, and says nothing that would fail a build.
 */
import { readFileSync } from 'node:fs'

const KEY = '6f1e11573616ffaf0234f5de9e35d82a'
const SITE = (process.env.SITE_URL ?? 'https://mytno.app').replace(/\/$/, '')
const host = new URL(SITE).host

const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
const urlList = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
})

console.log(`IndexNow: ${urlList.length} addresses → ${res.status} ${res.statusText}`)
