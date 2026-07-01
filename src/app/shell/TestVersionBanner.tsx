export const TEST_VERSION_WARNING =
  'Versão de teste - o SeCuida não realiza diagnóstico e não substitui atendimento profissional.';

export function TestVersionBanner() {
  return (
    <div className="bg-amber-200 text-amber-950 border-b border-amber-300 px-container-padding-mobile py-2 text-center font-label-md">
      {TEST_VERSION_WARNING}
    </div>
  );
}
