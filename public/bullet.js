function move_bullets(bullets) {
  if (bullets != []) {
    let bullet_counter = 0;
    for (const bullet of bullets) {
      if (Date.now() - bullet.spawn_time > bullet_despawn) {
        if (bullets.length > 1) {
          bullets.splice(bullet_counter, bullet_counter);
        } else {
          bullets.pop();
        }
      } else {
        bullet.x += bullet.angle[0] *
          ((Date.now() - bullet.update_time) / 20);
        bullet.y += bullet.angle[1] *
          ((Date.now() - bullet.update_time) / 20);
        bullet.update_time = Date.now();
      }
      bullet_counter += 1;
    }
  }
  return bullets;
}
