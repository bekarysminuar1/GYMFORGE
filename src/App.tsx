import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BarChart3, Dumbbell, Home, LayoutList, Play, User } from 'lucide-react'
import { useStore } from './store/AppStore'
import { Button, Skeleton } from './components/ui'
import Onboarding from './pages/Onboarding'
import HomePage from './pages/HomePage'
import ProgramPage from './pages/ProgramPage'
import WorkoutPage from './pages/WorkoutPage'
import ExercisesPage from './pages/ExercisesPage'
import ProgressPage from './pages/ProgressPage'
import ProfilePage from './pages/ProfilePage'

const NAV = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/program', label: 'Программа', icon: LayoutList },
  { to: '/workout', label: 'Тренировка', icon: Play },
  { to: '/exercises', label: 'Упражнения', icon: Dumbbell },
  { to: '/progress', label: 'Прогресс', icon: BarChart3 },
  { to: '/profile', label: 'Профиль', icon: User },
]

function NavItems({ side }: { side?: boolean }) {
  const { data } = useStore()
  return (
    <>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            side
              ? `flex h-12 items-center gap-3 rounded-2xl px-4 font-bold transition ${isActive ? 'bg-lime text-bg' : 'text-mute hover:bg-surface hover:text-ink'}`
              : `relative grid h-12 w-12 place-items-center rounded-full transition active:scale-95 ${isActive ? 'bg-lime text-bg' : to === '/workout' ? 'bg-surface-2 text-lime' : 'bg-surface-2 text-mute'}`
          }
        >
          <span className="relative">
            <Icon size={side ? 20 : 22} />
            {to === '/workout' && data.activeSession && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-ember" aria-label="Тренировка идёт" />
            )}
          </span>
          {side && label}
        </NavLink>
      ))}
    </>
  )
}

export default function App() {
  const { data, load, resetAll } = useStore()
  const loc = useLocation()

  if (load.status === 'loading')
    return (
      <div className="mx-auto max-w-xl space-y-4 p-5">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-56" />
        <Skeleton className="h-24" />
      </div>
    )

  if (load.status === 'corrupt')
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-extrabold text-danger">Данные повреждены</h1>
        <p className="mt-2 text-mute">
          Не удалось прочитать сохранённые данные. Вы можете скачать копию для восстановления и начать заново.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Button
            onClick={() => {
              const url = URL.createObjectURL(new Blob([load.raw], { type: 'application/json' }))
              const a = document.createElement('a')
              a.href = url
              a.download = 'gymforge-backup.json'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Скачать копию
          </Button>
          <Button variant="danger" onClick={resetAll}>
            Сбросить и начать заново
          </Button>
        </div>
      </div>
    )

  if (!data.profile) return <Onboarding />

  const inWorkout = loc.pathname.startsWith('/workout') && !!data.activeSession

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-2 border-r border-line p-5 lg:flex">
        <div className="num mb-6 text-4xl text-lime">GYMFORGE</div>
        <NavItems side />
      </aside>
      <main className={`mx-auto w-full max-w-3xl px-5 pt-6 ${inWorkout ? 'pb-8' : 'pb-32'} lg:pb-10`}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/program" element={<ProgramPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!inWorkout && (
        <nav
          aria-label="Основная навигация"
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center lg:hidden"
        >
          <div className="flex gap-1.5 rounded-full border border-line bg-bg/95 p-1.5 shadow-2xl backdrop-blur">
            <NavItems />
          </div>
        </nav>
      )}
    </div>
  )
}
