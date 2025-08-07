import SessionExamResults from '@/components/results/SessionExamResults'

interface ResultsPageProps {
  params: Promise<{ id: string }>
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params

  return <SessionExamResults attemptId={id} />
}