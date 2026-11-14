-- Opskrifter får et mærke: 'egen' (min egen opskrift) eller 'importeret' (importeret opskrift).
-- Alle opskrifter, der findes i forvejen, bliver 'egen'. Kan køres flere gange.
alter table opskrifter add column if not exists kilde text not null default 'egen';
alter table opskrifter drop constraint if exists opskrifter_kilde_check;
alter table opskrifter add constraint opskrifter_kilde_check check (kilde in ('egen', 'importeret'));
notify pgrst, 'reload schema';
