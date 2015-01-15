pragma foreign_keys = ON;

create table users (
  id integer primary key,
  email text not null,
  extra_data text,
  unique(email)
);

create table tasks (
  owner integer not null,
  id text not null,
  version integer not null,
  content blob not null,
  foreign key(owner) references users(id),
  unique(owner, id)
);
