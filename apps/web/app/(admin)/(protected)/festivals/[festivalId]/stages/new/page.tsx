import { CreateStageForm } from './create-stage-form';

export default async function NewStagePage(props: PageProps<'/festivals/[festivalId]/stages/new'>) {
  const { festivalId } = await props.params;
  return <CreateStageForm festivalId={festivalId} />;
}
