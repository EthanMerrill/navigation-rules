import '../styles/styles.css'

const RulesSidebar = () => {

    return(
        <div className={'rules-sidebar'} >
            <div className={'rules-sidebar__header'} style={{width:'100%'}}>
                <h2>Right-of-Way Rules</h2>
            </div>
            <div className={'rules-sidebar__content'}>
                <div className={'rules-sidebar__content__section'}>
                    <h3>Port-Starboard</h3>
                    <p>A port-tack boat must keep clear of a starboard-tack boat. <b>Rule 10</b> You are keeping clear of another boat if it doesn't have to avoid you.</p>
                </div>
                <div className={'rules-sidebar__content__section'}>
                    <h3>Windward-Leeward</h3>
                    <p>When boats are overlapped on the same tack, the windward boat must keep clear <b>Rule 11</b></p>
                </div>
            </div>
        </div>
    )

}
export default RulesSidebar