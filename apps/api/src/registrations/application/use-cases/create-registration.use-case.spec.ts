import { CreateRegistrationUseCase } from './create-registration.use-case';
import { CreateFestivalUseCase } from '../../../festivals/application/use-cases/create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../../festivals/infrastructure/in-memory-festivals.repository';
import { InMemoryRegistrationsRepository } from '../../infrastructure/in-memory-registrations.repository';
import { InvalidFestivalStateError } from '../../../festivals/domain/invalid-festival-state.error';

const baseFestivalInput = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01T00:00:00Z'),
  registrationEnd: new Date('2026-03-01T00:00:00Z'),
  inscriptionFee: 25,
};

const baseRegistrationInput = {
  tenantId: 'tenant-1',
  participantName: 'Mai Sato',
  participantEmail: 'mai.sato@example.com',
  participantCpf: '86359899531',
  songName: 'Chora Menino',
  performers: 'Mai Sato: Canto e Harpa',
};

describe('CreateRegistrationUseCase', () => {
  // The use-case reads the wall clock internally (`new Date()`), so tests that
  // need "now" to fall inside the fixed registrationBegin/registrationEnd
  // window pin the system time rather than depending on when the suite runs.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    jest.setSystemTime(new Date('2026-02-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a registration when the festival is OPEN and within the registration window', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = (
      await new CreateFestivalUseCase(festivalsRepository).execute(
        baseFestivalInput,
      )
    ).publish();
    await festivalsRepository.save(festival);

    const useCase = new CreateRegistrationUseCase(
      festivalsRepository,
      registrationsRepository,
    );
    const registration = await useCase.execute({
      ...baseRegistrationInput,
      festivalId: festival.id,
    });

    expect(registration?.festivalId).toBe(festival.id);
    expect(registration?.participantName).toBe('Mai Sato');
  });

  it('returns null when the festival does not belong to the tenant', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = (
      await new CreateFestivalUseCase(festivalsRepository).execute(
        baseFestivalInput,
      )
    ).publish();
    await festivalsRepository.save(festival);

    const useCase = new CreateRegistrationUseCase(
      festivalsRepository,
      registrationsRepository,
    );
    const registration = await useCase.execute({
      ...baseRegistrationInput,
      tenantId: 'tenant-2',
      festivalId: festival.id,
    });

    expect(registration).toBeNull();
  });

  it('rejects when the festival is still DRAFT', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = await new CreateFestivalUseCase(
      festivalsRepository,
    ).execute(baseFestivalInput);

    const useCase = new CreateRegistrationUseCase(
      festivalsRepository,
      registrationsRepository,
    );
    await expect(
      useCase.execute({ ...baseRegistrationInput, festivalId: festival.id }),
    ).rejects.toThrow(InvalidFestivalStateError);
  });

  it('rejects when the festival is CLOSED', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = (
      await new CreateFestivalUseCase(festivalsRepository).execute(
        baseFestivalInput,
      )
    )
      .publish()
      .close();
    await festivalsRepository.save(festival);

    const useCase = new CreateRegistrationUseCase(
      festivalsRepository,
      registrationsRepository,
    );
    await expect(
      useCase.execute({ ...baseRegistrationInput, festivalId: festival.id }),
    ).rejects.toThrow(InvalidFestivalStateError);
  });
});
