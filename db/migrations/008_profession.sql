-- Who the specialty's professionals are: physicians, dentists or psychologists. Drives the wording ("Médico verificado" vs
-- "Profesional verificado"), the title (psychologists get none), the schema.org type and the professional-college badge.
alter table specialties add column if not exists profession text not null default 'medico' check (profession in ('medico', 'odontologo', 'psicologo'));
update specialties set profession = 'odontologo' where slug in ('odontologos', 'ortodoncistas', 'endodoncistas', 'periodoncistas', 'cirujanos-maxilofaciales');
update specialties set profession = 'psicologo' where slug = 'psicologos';
