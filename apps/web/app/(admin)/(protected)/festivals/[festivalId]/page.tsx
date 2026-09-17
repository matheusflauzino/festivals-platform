import { FestivalDetail } from './festival-detail';

export default async function FestivalDetailPage(props: PageProps<'/festivals/[festivalId]'>) {
  const { festivalId } = await props.params;
  return <FestivalDetail festivalId={festivalId} />;
}
