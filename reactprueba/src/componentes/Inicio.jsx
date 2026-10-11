// src/componentes/Inicio.jsx
import React from 'react';

function Home({ onStart }) {
    return (
        <main className="home">
            {/* Encabezado de la iglesia */}
            <header className="church">
                <span className="church-dove" aria-hidden="true">🕊️</span>
                <h2 className="church-name">Iglesia Jehová Sama</h2>
                <span className="church-dove church-dove-2 " aria-hidden="true">🕊️</span>
            </header>

            <div className="home-body">
                <div className="mini-wheel-wrap" aria-hidden="true">
                    <div className="mini-needle" />
                    <div className="mini-wheel">
                        <div className="mini-hub">🎰</div>
                    </div>
                </div>

                <h1 className="home-title">
                    Ruleta de <span>Números</span>
                </h1>
                <p className="home-lead">
                    Sorteos transparentes y con emoción: dos números se van <strong>al agua</strong> y el tercero se lleva
                    la victoria.
                </p>

                <div className="home-steps">
                    <div className="home-step">
                        <div className="home-step-icon water">💦</div>
                        <strong>1° y 2° tiro</strong>
                        <small>Al agua: el número sale de la ronda</small>
                    </div>
                    <div className="home-step">
                        <div className="home-step-icon gold">🏆</div>
                        <strong>3° tiro</strong>
                        <small>¡Número ganador!</small>
                    </div>
                    <div className="home-step">
                        <div className="home-step-icon violet">🔁</div>
                        <strong>Sin repetir</strong>
                        <small>Nunca sale dos veces en la misma ronda</small>
                    </div>
                </div>

                <button type="button" className="btn btn-gold btn-xl" onClick={onStart}>
                    Ir a la ruleta →
                </button>
            </div>
        </main>
    );
}

export default Home;