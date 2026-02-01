export default function CustomLoader() {
    return (
        <div className="custom-loader">
            <span>&lt;</span>
            <span>RIFT</span>
            <span>/&gt;</span>
            <style jsx>{`
                .custom-loader {
                    font-size: 2em;
                    font-weight: 900;
                }
                .custom-loader > * {
                    color: #c0211f;
                }
                .custom-loader span {
                    display: inline-flex;
                }
                .custom-loader span:nth-child(2) {
                    letter-spacing: -1em;
                    overflow: hidden;
                    animation: reveal 1500ms cubic-bezier(0.645, 0.045, 0.355, 1) infinite alternate;
                }
                @keyframes reveal {
                    0%,
                    100% {
                        opacity: 0.5;
                        letter-spacing: -1em;
                    }
                    50% {
                        opacity: 1;
                        letter-spacing: 0em;
                    }
                }
            `}</style>
        </div>
    )
}
