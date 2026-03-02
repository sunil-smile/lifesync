'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Flame, Zap, Star, Trophy, TrendingUp } from 'lucide-react';

const GRADE_COLOR: Record<string, string> = { 'A+': 'text-emerald-400', A: 'text-emerald-400', 'A-': 'text-emerald-300', 'B+': 'text-blue-400', B: 'text-blue-400', 'B-': 'text-blue-300', 'C+': 'text-amber-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400' };
const GRADE_BG: Record<string, string> = { 'A+': 'bg-emerald-500/10 border-emerald-500/30', A: 'bg-emerald-500/10 border-emerald-500/30', 'A-': 'bg-emerald-500/10 border-emerald-500/30', 'B+': 'bg-blue-500/10 border-blue-500/30', B: 'bg-blue-500/10 border-blue-500/30', 'B-': 'bg-blue-500/10 border-blue-500/30', 'C+': 'bg-amber-500/10 border-amber-500/30', C: 'bg-amber-500/10 border-amber-500/30', D: 'bg-orange-500/10 border-orange-500/30', F: 'bg-red-500/10 border-red-500/30' };

function GradeCard({ label, score, grade, detail }: { label: string; score: number; grade: string; detail: string }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${GRADE_BG[grade] ?? 'bg-slate-700/50 border-slate-600'}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-4xl font-black mb-1 ${GRADE_COLOR[grade] ?? 'text-slate-300'}`}>{grade}</p>
      <p className="text-sm font-semibold text-slate-300">{score}/100</p>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
    </div>
  );
}

export default function MotivationPage() {
  const { data, isLoading } = useQuery({ queryKey: ['motivation'], queryFn: () => axios.get('/api/motivation').then(r => r.data) });

  if (isLoading) return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  if (!data) return null;

  const { streaks, xpData, weeklyReport: wr, partnerStats, todayQuote } = data;

  return (
    <div className="p-6 space-y-8">
      <Header title="Motivation" />

      {/* Today's Quote */}
      {todayQuote && (
        <Card>
          <div className="flex items-start gap-4">
            <Star size={24} className="text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <blockquote className="text-slate-100 text-lg font-medium leading-relaxed italic">&ldquo;{todayQuote.text}&rdquo;</blockquote>
              {todayQuote.author && <p className="text-slate-400 text-sm mt-2">— {todayQuote.author}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* XP & Level */}
      <Card title="XP & Level Progress">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex-shrink-0 text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/20 border-2 border-blue-500/40 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-blue-400">Lv{xpData?.level}</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">{xpData?.levelName}</p>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 font-medium">{xpData?.xp} XP</span>
              <span className="text-xs text-slate-500">Next: {xpData?.nextLevelXP} XP</span>
            </div>
            <ProgressBar value={xpData?.progressPct ?? 0} color="blue" size="lg" />
            <p className="text-xs text-slate-500">{(xpData?.nextLevelXP ?? 0) - (xpData?.xp ?? 0)} XP to reach <strong className="text-slate-300">Level {(xpData?.level ?? 1) + 1}</strong></p>
          </div>
        </div>

        {/* Partner comparison */}
        {partnerStats && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><TrendingUp size={16} />Family XP Comparison</p>
            <div className="space-y-3">
              {[{ name: 'Sunil', xp: xpData?.xp ?? 0, color: 'blue' as const }, { name: partnerStats.name, xp: partnerStats.xp, color: 'violet' as const }].map(p => {
                const maxXP = Math.max(xpData?.xp ?? 0, partnerStats.xp) || 1;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.color === 'blue' ? 'bg-blue-500' : 'bg-violet-500'}`}>{p.name[0]}</div>
                    <span className="text-sm text-slate-300 w-16">{p.name}</span>
                    <ProgressBar value={(p.xp / maxXP) * 100} color={p.color} size="sm" className="flex-1" />
                    <span className="text-sm font-semibold text-slate-200 w-16 text-right">{p.xp} XP</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Streaks */}
      {streaks?.length > 0 && (
        <Card title="Current Streaks" subtitle="Consecutive days completed">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {streaks.slice(0, 6).map((s: { habitId: string; habitName: string; icon: string; currentStreak: number; longestStreak: number }) => (
              <div key={s.habitId} className="bg-slate-700/50 rounded-xl p-4 text-center border border-slate-600">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-2xl font-bold text-slate-100">{s.currentStreak}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 truncate">{s.habitName}</p>
                <p className="text-xs text-slate-600 mt-0.5">Best: {s.longestStreak}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly Report Card */}
      {wr && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2"><Trophy size={20} className="text-amber-400" />Weekly Report Card</h2>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black ${GRADE_COLOR[wr.overall?.grade] ?? 'text-slate-300'}`}>{wr.overall?.grade}</span>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-300">{wr.overall?.score}/100</p>
                <p className="text-xs text-slate-500">Overall</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Habits', key: 'habits' }, { label: 'Workouts', key: 'workouts' },
              { label: 'Sleep', key: 'sleep' }, { label: 'Finance', key: 'finance' },
              { label: 'Tasks', key: 'tasks' },
            ].map(({ label, key }) => <GradeCard key={key} label={label} score={wr[key]?.score ?? 0} grade={wr[key]?.grade ?? 'F'} detail={wr[key]?.detail ?? ''} />)}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">🏆 Win of the Week</p>
              <p className="text-slate-200 font-semibold capitalize">{wr.winOfWeek}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">📈 Improve This Week</p>
              <p className="text-slate-200 font-semibold capitalize">{wr.improveArea}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 py-3 bg-slate-800 rounded-xl border border-slate-700">
            <Zap size={16} className="text-amber-400" />
            <p className="text-slate-300 text-sm font-medium">+<span className="text-amber-400 font-bold text-lg">{wr.xpEarnedThisWeek}</span> XP earned this week</p>
          </div>
        </div>
      )}
    </div>
  );
}
