import { describe, expect, it } from 'vitest'
import { canonicalPath, resolveLink, switchWorkspace } from './routes'

describe('addresses carry the workspace', () => {
  it('moves old addresses under the workspace that owns the section', () => {
    expect(canonicalPath('/cases/abc', 'all')).toBe('/sb/cases/abc')
    expect(canonicalPath('/projects', 'sb')).toBe('/fsa/projects')
    expect(canonicalPath('/overview', 'sb')).toBe('/all/overview')
  })
  it('lets agents live under any workspace', () => {
    expect(canonicalPath('/agents/cases', 'sb')).toBe('/sb/agents/cases')
    expect(canonicalPath('/fsa/agents', 'sb')).toBe('/fsa/agents')
    expect(switchWorkspace('/sb/agents/cases/history', 'fsa')).toBe('/fsa/agents')
  })
  it('puts shared sections under the workspace you are in', () => {
    expect(canonicalPath('/tasks', 'fsa')).toBe('/fsa/tasks')
    expect(canonicalPath('/today/2026-10-31', 'sb')).toBe('/sb/today/2026-10-31')
  })
  it('corrects a section under the wrong workspace and leaves right ones alone', () => {
    expect(canonicalPath('/fsa/cases', 'fsa')).toBe('/sb/cases')
    expect(canonicalPath('/all/cases/1', 'all')).toBe('/sb/cases/1')
    expect(canonicalPath('/sb/cases/1', 'all')).toBe('/sb/cases/1')
    expect(canonicalPath('/media/tasks', 'sb')).toBe('/media/tasks')
  })
  it('sends the unknown to the landing page', () => {
    expect(canonicalPath('/', 'all')).toBe('/all/overview')
    expect(canonicalPath('/sb', 'all')).toBe('/sb/needs')
    expect(canonicalPath('/sb/nope', 'all')).toBe('/sb/needs')
    expect(canonicalPath('/whatever', 'media')).toBe('/media/needs')
  })
})

describe('switching workspace', () => {
  it('keeps the shared section you are on', () => {
    expect(switchWorkspace('/sb/tasks', 'fsa')).toBe('/fsa/tasks')
    expect(switchWorkspace('/sb/today/2026-10-31', 'media')).toBe('/media/today/2026-10-31')
    expect(switchWorkspace('/sb/plans/xyz', 'fsa')).toBe('/fsa/plans')
  })
  it('goes to the landing page when the section does not exist there', () => {
    expect(switchWorkspace('/sb/cases/1', 'fsa')).toBe('/fsa/needs')
    expect(switchWorkspace('/sb/cases', 'all')).toBe('/all/overview')
    expect(switchWorkspace('/all/overview', 'sb')).toBe('/sb/needs')
  })
})

describe('links written the short way', () => {
  it('get the full address, keeping the query and anchor', () => {
    expect(resolveLink('/cases/1?x=1#top', 'all')).toBe('/sb/cases/1?x=1#top')
    expect(resolveLink('/tasks', 'fsa')).toBe('/fsa/tasks')
  })
  it('leave other addresses alone', () => {
    expect(resolveLink('/login', 'sb')).toBe('/login')
    expect(resolveLink('/', 'sb')).toBe('/')
    expect(resolveLink('https://example.com', 'sb')).toBe('https://example.com')
    expect(resolveLink('detail', 'sb')).toBe('detail')
  })

  it('keeps Mail in the workspace you are in', () => {
    expect(canonicalPath('/sb/mail', 'all')).toBe('/sb/mail')
    expect(canonicalPath('/mail', 'fsa')).toBe('/fsa/mail')
    expect(switchWorkspace('/sb/mail', 'media')).toBe('/media/mail')
  })

  it('keeps Attention and News under S&B', () => {
    expect(canonicalPath('/personal/news', 'personal')).toBe('/sb/news')
    expect(canonicalPath('/fsa/attention', 'fsa')).toBe('/sb/attention')
    expect(switchWorkspace('/sb/news', 'personal')).toBe('/personal/needs')
    expect(switchWorkspace('/personal/today', 'sb')).toBe('/sb/today')
  })
})
